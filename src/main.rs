mod queries;
mod structs;
mod create_db;

use std::fs::File;
use std::future::Future;
use std::io::{BufReader, Read};
use std::pin::Pin;
use std::sync::Mutex;
use actix_files::NamedFile;
use actix_web::{App, cookie, error, FromRequest, get, HttpRequest, HttpResponse, HttpServer, post, Responder, Result, web};
use actix_web::dev::Payload;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rand::distributions::Alphanumeric;
use rand::prelude::*;
use rand_chacha::ChaCha20Rng;
use structs::{ForumStructure, Message, MessagesQuery, MessagesQueryResult, Section, SubSection, Thread, ThreadQuery, ThreadsQueryType, User};
use crate::queries::{add_favorite_article, create_article, create_section, create_sub_section, create_thread, delete_article, delete_thread, find_user, move_subsection, move_thread, query_article, query_article_comments, query_articles, query_articles_by_search_params, query_favorite_articles, query_file, query_forum_structure, query_messages_by_search_params, query_sessions, query_thread, query_thread_count, query_thread_messages, query_threads, query_user_by_session, QueryResult, remove_all_sessions, remove_favorite_article, remove_session, rename_section, rename_subsection, rename_thread, save_comment, save_file_mapping, save_message, save_user, save_user_password, save_user_session, update_article, update_comment, update_message, verify_user_password};
use crate::structs::{AddFavoriteArticle, Article, Articles, ArticleSearchParams, ArticleSearchResults, CommentsQuery, CommentsQueryResult, CreateArticle, CreateThreadMessage, DeleteArticle, DeleteThread, GetArticle, LogicError, LogoutParams, MessageSearchParams, MessageSearchResults, MoveSubsection, MoveThread, PostComment, PostMessage, PostNewSection, PostNewSubsection, RemoveFavoriteArticle, RemoveSession, RenameSection, RenameSubsection, RenameThread, SignOnParams, SignUpParams, ThreadQueryResult, UpdateArticle, UpdateComment, UpdateMessage, UploadedFile, UploadedFiles, UploadedFileWithLocation, UserSessions};

use data_encoding::HEXLOWER;
use ring::digest::{Context, Digest, SHA256};

use actix_easy_multipart::tempfile::Tempfile;
use actix_easy_multipart::MultipartForm;
use actix_web::http::header::{Charset, ContentDisposition, DispositionParam, DispositionType, ExtendedValue};
use actix_web::http::StatusCode;
use actix_web::web::Bytes;
use crate::create_db::create_db;

async fn index() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("text/html; charset=utf-8")
        .body(include_str!("../web/index.html")))
}

#[cfg(debug_assertions)]
async fn js_bundle() -> Result<NamedFile> {
    Ok(NamedFile::open("web/dist/bundle.js")?)
}

#[cfg(not(debug_assertions))]
async fn js_bundle() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("text/javascript")
        .body(include_str!("../web/dist/bundle.min.js")))
}

#[cfg(debug_assertions)]
async fn style() -> Result<NamedFile> {
    Ok(NamedFile::open("web/dist/bundle.css")?)
}

#[cfg(not(debug_assertions))]
async fn style() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("text/css")
        .body(include_str!("../web/dist/bundle.min.css")))
}

async fn icons_css() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("text/css")
        .body(include_str!("../web/css/icons.css")))
}

async fn icons_ttf() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("font/ttf")
        .body(Bytes::from_static(include_bytes!("../web/fonts/icomoon.ttf"))))
}

async fn icons_woff() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("font/woff")
        .body(Bytes::from_static(include_bytes!("../web/fonts/icomoon.woff"))))
}

async fn icons_svg() -> Result<HttpResponse> {
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type("image/svg+xml")
        .body(Bytes::from_static(include_bytes!("../web/fonts/icomoon.svg"))))
}

#[derive(Clone)]
struct DbStorage
{
    main_db_pool: Pool<SqliteConnectionManager>,
    user_passwords_db_pool: Pool<SqliteConnectionManager>,
    user_sessions_db_pool: Pool<SqliteConnectionManager>,
}

#[get("/api/structure")]
async fn get_forum_structure(storage: web::Data<DbStorage>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let result: QueryResult<ForumStructure> = web::block(move || {
        let conn = pool.get()?;

        query_forum_structure(&conn)
    }).await?;

    Ok(web::Json(result.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/threads")]
async fn get_threads(params: web::Query<ThreadQuery>, storage: web::Data<DbStorage>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let threads: Result<ThreadQueryResult, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;

        let threads = query_threads(&conn, &params)?;
        let count = query_thread_count(&conn, &params)?;

        return Ok(ThreadQueryResult{threads, count})
    })
    .await?;

    Ok(web::Json(threads.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/messages")]
async fn get_messages(params: web::Query<MessagesQuery>, storage: web::Data<DbStorage>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let messages: Result<Option<MessagesQueryResult>, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;

        let thread = query_thread(&conn, params.thread_id)?;
        if let None = thread {
            return Ok(None);
        }

        let thread = thread.unwrap();
        let messages = query_thread_messages(&conn, params.thread_id, params.page)?;
        Ok(Some(MessagesQueryResult{thread, messages}))
    })
    .await?;

    Ok(web::Json(messages.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/comments")]
async fn get_article_comments(params: web::Query<CommentsQuery>, storage: web::Data<DbStorage>, principal: Option<CallerPrincipal>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let messages: Result<CommentsQueryResult, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;
        let result = query_article_comments(&conn, params.article_id, params.page, &principal.map(|p| p.user))?;
        return Ok(result);
    })
    .await?;

    Ok(web::Json(messages.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/search-messages")]
async fn get_search_messages(params: web::Query<MessageSearchParams>, storage: web::Data<DbStorage>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let messages: Result<MessageSearchResults, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;

        let result = query_messages_by_search_params(&conn, &params)?;
        Ok(result)
    })
    .await?;

    Ok(web::Json(messages.map_err(error::ErrorInternalServerError)?))
}

#[post("/signon")]
async fn signon(params: web::Json<SignOnParams>,
                storage: web::Data<DbStorage>,
                rng: web::Data<RandomGenerator>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();
    let pass_pool = storage.user_passwords_db_pool.clone();
    let sessions_pool = storage.user_sessions_db_pool.clone();


    let session: String = {
        let mut rng = rng.rng.lock().unwrap();
        (&mut *rng).sample_iter(&Alphanumeric)
            .take(20)
            .map(char::from)
            .collect()
    };

    let session_copy = session.clone();

    let result: Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let user = find_user(&pool.get()?, &params.user_name)?;

        if let None = user {
            return Ok(None);
        }

        let user = user.unwrap();
        let verified = verify_user_password(&pass_pool.get()?, &user, &params.password)?;

        if !verified {
            return Ok(None);
        }

        save_user_session(&sessions_pool.get()?, &user, &session_copy)?;
        return Ok(Some(user));
    }).await?;

    let result = result.map_err(error::ErrorInternalServerError)?;

    if result.is_none() {
        return Ok(HttpResponse::Ok()
            .body("\"FAILED\""))
    }

    let session_cookie = cookie::Cookie::build("SESSION", session).finish();

    Ok(HttpResponse::Ok()
        .cookie(session_cookie)
        .json(result))
}

#[post("/signup")]
async fn signup(params: web::Json<SignUpParams>,
                storage: web::Data<DbStorage>) -> Result<impl Responder> {

    let pool = storage.main_db_pool.clone();
    let pass_pool = storage.user_passwords_db_pool.clone();

    let result: Result<bool, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = &pool.get()?;
        let user = find_user(&conn, &params.user_name)?;

        if let Some(_) = user {
            return Ok(false);
        }

        save_user(&conn, &params.user_name)?;

        let user = find_user(&conn, &params.user_name)?;
        if let None = user {
            return Ok(false);
        }

        let user = user.unwrap();
        save_user_password(&pass_pool.get()?, &user, &params.password)?;

        return Ok(true);
    }).await?;

    let saved = result.map_err(error::ErrorInternalServerError)?;

    if !saved {
        return Ok(HttpResponse::Ok().body("\"FAILED\""))
    }

    Ok(HttpResponse::Ok().body("\"OK\""))
}

fn get_user_session(req: &HttpRequest) -> Option<String> {
    let session = req.cookie("SESSION");
    if session.is_none() {
        return None;
    }

    Some(session.unwrap().value().to_string())
}

#[get("/api/current-user")]
async fn get_current_user(caller: CallerPrincipal) -> Result<impl Responder> {
    Ok(web::Json(caller.user))
}

#[get("/api/current-user-sessions")]
async fn get_user_sessions(req: HttpRequest, storage: web::Data<DbStorage>) -> Result<impl Responder> {
    let session = get_user_session(&req);

    let res: Result<UserSessions, Box<dyn std::error::Error + Send + Sync>>;

    if session.is_none() {
        res = Ok(UserSessions{sessions: Vec::new()});
    }
    else {
        res = web::block(move || {
            let pool = storage.user_sessions_db_pool.clone();
            let s = query_sessions(&mut pool.get()?, &session.unwrap())?;
            Ok(s)
        })
        .await?;
    }

    Ok(web::Json(res.map_err(error::ErrorInternalServerError)?))
}

#[post("/api/current-user-sessions/remove")]
async fn post_remove_user_session(req: HttpRequest, storage: web::Data<DbStorage>, params: web::Json<RemoveSession>) -> Result<impl Responder> {
    let session = get_user_session(&req);

    let res: Result<UserSessions, Box<dyn std::error::Error + Send + Sync>>;

    if session.is_none() {
        res = Ok(UserSessions{sessions: Vec::new()});
    }
    else {
        let session_to_remove = params.session.clone();
        res = web::block(move || {
            let pool = storage.user_sessions_db_pool.clone();
            remove_session(&mut pool.get()?, &session.unwrap(), &session_to_remove)
        })
        .await?;
    }

    let session = get_user_session(&req);
    let result = res.map_err(error::ErrorInternalServerError)?;
    let mut result = HttpResponse::Ok().json(result);

    if session.is_some() && session.unwrap() == params.session {
        result.add_removal_cookie(&req.cookie("SESSION").unwrap())?;
    }

    Ok(result)
}

#[post("/api/logout")]
async fn post_logout(req: HttpRequest, storage: web::Data<DbStorage>, params: web::Json<LogoutParams>) -> Result<impl Responder> {
    let session = get_user_session(&req);

    let res: Result<(), Box<dyn std::error::Error + Send + Sync>>;

    if session.is_some() {
        res = web::block(move || {
            let pool = storage.user_sessions_db_pool.clone();

            if params.remove_all_sessions {
                remove_all_sessions(&mut pool.get()?, &session.unwrap())?;
            }
            else {
                let current_session = session.unwrap();
                remove_session(&mut pool.get()?, &current_session, &current_session)?;
            }

            Ok(())
        })
        .await?;
    }
    else {
        res = Ok(());
    }

    res.map_err(error::ErrorInternalServerError)?;

    let session = get_user_session(&req);
    let mut result = HttpResponse::Ok().body("OK");

    if session.is_some() {
        result.add_removal_cookie(&req.cookie("SESSION").unwrap())?;
    }

    Ok(result)
}

#[post("/api/thread")]
async fn post_thread(params: web::Json<CreateThreadMessage>,
                      storage: web::Data<DbStorage>,
                      caller: CallerPrincipal) -> Result<impl Responder> {

    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        create_thread(&mut pool.get()?, &params, &caller.user)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/message")]
async fn post_message(params: web::Json<PostMessage>,
                    storage: web::Data<DbStorage>,
                    caller: CallerPrincipal) -> Result<impl Responder> {

    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        save_message(&mut pool.get()?, &params, &caller.user)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/comment")]
async fn post_comment(params: web::Json<PostComment>,
                      storage: web::Data<DbStorage>,
                      caller: CallerPrincipal) -> Result<impl Responder> {

    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        save_comment(&mut pool.get()?, &params, &caller.user)?;
        Ok(())
    })
        .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/message/update")]
async fn post_update_message(params: web::Json<UpdateMessage>,
                             storage: web::Data<DbStorage>,
                             caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        update_message(&mut pool.get()?, &params, &caller.user)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/comment/update")]
async fn post_update_article_comment(params: web::Json<UpdateComment>,
                             storage: web::Data<DbStorage>,
                             caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        update_comment(&mut pool.get()?, &params, &caller.user)?;
        Ok(())
    })
        .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/section")]
async fn post_new_section(params: web::Json<PostNewSection>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        create_section(&mut pool.get()?, &params.name)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/subsection")]
async fn post_new_subsection(params: web::Json<PostNewSubsection>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        create_sub_section(&mut pool.get()?, params.section_id, &params.name)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/section/rename")]
async fn post_rename_section(params: web::Json<RenameSection>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        rename_section(&mut pool.get()?, params.section_id, &params.name)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/subsection/rename")]
async fn post_rename_subsection(params: web::Json<RenameSubsection>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        rename_subsection(&mut pool.get()?, params.subsection_id, &params.name)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/subsection/move")]
async fn post_move_subsection(params: web::Json<MoveSubsection>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        move_subsection(&mut pool.get()?, params.subsection_id, params.new_section_id)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/thread/rename")]
async fn post_rename_thread(params: web::Json<RenameThread>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        rename_thread(&mut pool.get()?, params.thread_id, &params.name)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/thread/move")]
async fn post_move_thread(params: web::Json<MoveThread>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        move_thread(&mut pool.get()?, params.thread_id, params.new_subsection_id)?;
        Ok(())
    })
        .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/thread/delete")]
async fn post_delete_thread(params: web::Json<DeleteThread>, storage: web::Data<DbStorage>) -> Result<impl Responder>  {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        delete_thread(&mut pool.get()?, params.thread_id)?;
        Ok(())
    })
    .await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[derive(MultipartForm)]
struct Upload {
    #[multipart(rename="file_set[]")]
    file_set: Vec<Tempfile>,
}

fn sha256_digest(file: &File) -> QueryResult<Digest> {
    let mut reader = BufReader::new(file);

    let mut context = Context::new(&SHA256);
    let mut buffer = [0; 1024];

    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        context.update(&buffer[..count]);
    }

    Ok(context.finish())
}

#[post("/api/upload-files")]
async fn post_upload(form: MultipartForm<Upload>, storage: web::Data<DbStorage>, caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<UploadedFiles, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let file_set: &Vec<Tempfile> = &form.file_set;

        let pool = storage.main_db_pool.clone();

        let mut files = Vec::new();

        let mut i = 0;
        for file in file_set.iter() {
            let input = File::open(file.file.path())?;
            let digest = sha256_digest(&input)?;
            let hex = HEXLOWER.encode(digest.as_ref());
            let result_file_path = "files/".to_owned() + &hex;
            std::fs::create_dir_all("files")?;
            std::fs::copy(file.file.path(), &result_file_path)?;

            let mime = if let Some(content_type) = &file.content_type {
                content_type.as_ref().to_string()
            }
            else {
                "application/octet-stream".to_string()
            };

            let original_file_name = if let Some(file_name) = &file.file_name {
                file_name.to_string()
            }
            else {
                "file".to_string()
            };

            let id = save_file_mapping(&mut pool.get()?, &hex, &mime, &original_file_name, &caller.user, i)?;
            files.push(UploadedFile {
                id, file_name: original_file_name, mime: mime
            });

            i = i + 1;
        }

        Ok(UploadedFiles{files})
    })
    .await?;

    Ok(web::Json(res.map_err(error::ErrorInternalServerError)?))
}

#[post("/api/article")]
async fn post_create_article(params: web::Json<CreateArticle>, storage: web::Data<DbStorage>, caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        create_article(&mut pool.get()?, &params.path, &params.name, &params.content, params.visibility, &caller.user)?;
        Ok(())
    }).await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/article/update")]
async fn post_update_article(params: web::Json<UpdateArticle>, storage: web::Data<DbStorage>, caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        update_article(&mut pool.get()?, params.id, &params.path, &params.name, &params.content, params.visibility, caller.user)?;
        Ok(())
    }).await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/article/delete")]
async fn post_delete_article(params: web::Json<DeleteArticle>, storage: web::Data<DbStorage>, caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        delete_article(&mut pool.get()?, params.id, &Some(caller.user))?;
        Ok(())
    }).await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/article/favorite/add")]
async fn post_add_favorite_article(params: web::Json<AddFavoriteArticle>, storage: web::Data<DbStorage>, caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        add_favorite_article(&mut pool.get()?, &caller.user, params.id)?;
        Ok(())
    }).await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[post("/api/article/favorite/remove")]
async fn post_remove_favorite_article(params: web::Json<RemoveFavoriteArticle>, storage: web::Data<DbStorage>, caller: CallerPrincipal) -> Result<impl Responder> {
    let res: Result<(), Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let pool = storage.main_db_pool.clone();
        remove_favorite_article(&mut pool.get()?, &caller.user, params.id)?;
        Ok(())
    }).await?;

    res.map_err(error::ErrorInternalServerError)?;

    return Ok(HttpResponse::Ok().body("\"OK\""))
}

#[get("/api/article/list")]
async fn get_articles(storage: web::Data<DbStorage>, principal: Option<CallerPrincipal>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let messages: Result<Articles, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;
        let result = query_articles(&conn, &principal.map(|p| p.user))?;
        Ok(result)
    })
    .await?;

    Ok(web::Json(messages.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/article/favorite/list")]
async fn get_favorite_articles(storage: web::Data<DbStorage>, principal: CallerPrincipal) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let messages: Result<Articles, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;
        let result = query_favorite_articles(&conn, &principal.user)?;
        Ok(result)
    })
        .await?;

    Ok(web::Json(messages.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/article")]
async fn get_article(params: web::Query<GetArticle>, storage: web::Data<DbStorage>, principal: Option<CallerPrincipal>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let article: Result<Article, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;
        let result = query_article(&conn, params.id, params.version, &principal.map(|p| p.user))?;
        Ok(result)
    })
    .await?;

    Ok(web::Json(article.map_err(error::ErrorInternalServerError)?))
}

#[get("/api/search-articles")]
async fn get_search_articles(params: web::Query<ArticleSearchParams>, storage: web::Data<DbStorage>, principal: Option<CallerPrincipal>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let messages: Result<ArticleSearchResults, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let conn = pool.get()?;
        let result = query_articles_by_search_params(&conn, &params, &principal.map(|p| p.user))?;
        Ok(result)
    })
    .await?;

    Ok(web::Json(messages.map_err(error::ErrorInternalServerError)?))
}

#[get("/files/{id}")]
async fn get_uploaded_file(id: web::Path<String>, storage: web::Data<DbStorage>) -> Result<impl Responder> {
    let pool = storage.main_db_pool.clone();

    let res: Result<UploadedFileWithLocation, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
        let file = query_file(&mut pool.get()?, id.into_inner())?;
        Ok(file)
    })
    .await?;

    let res = res.map_err(error::ErrorInternalServerError)?;

    let file_path = "files/".to_owned() + &res.file_path;
    let mut result = NamedFile::open(file_path)?;

    let mime = res.file.mime.parse();

    if let Ok(mime) = mime {
        result = result.set_content_type(mime);
    }

    println!("{} {}", res.file.file_name, res.file.mime);

    result = result.set_content_disposition(ContentDisposition {
        disposition: if res.file.mime.starts_with("image/") {DispositionType::Inline} else {DispositionType::Attachment},
        parameters: vec![
            DispositionParam::FilenameExt(ExtendedValue {
                charset: Charset::Ext(String::from("UTF-8")),
                language_tag: None,
                value: res.file.file_name.clone().into_bytes(),
            }),
            // fallback for better compatibility
            DispositionParam::Filename(res.file.file_name)
        ],
    });

    return Ok(result);
}

struct RandomGenerator {
    rng: Mutex<ChaCha20Rng>,
}

struct CallerPrincipal {
    user: User,
}

impl FromRequest for CallerPrincipal {
    type Error = actix_web::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        Self::extract(req)
    }

    fn extract(req: &HttpRequest) -> Self::Future {
        let session = get_user_session(&req);

        if session.is_none() {
            return Box::pin(async move {
                let err: Result<CallerPrincipal, Box<dyn std::error::Error + Send + Sync>> = Err(LogicError::NoSession.into()).into();
                err.map_err(error::ErrorInternalServerError)
            });
        }

        let storage = req.app_data::<web::Data<DbStorage>>().unwrap();
        let pool = storage.main_db_pool.clone();
        let user_sessions_pool = storage.user_sessions_db_pool.clone();

        Box::pin(async move {
            let user: Result<User, Box<dyn std::error::Error + Send + Sync>> = web::block(move || {
                let user = query_user_by_session(&pool.get()?, &user_sessions_pool.get()?, &session.unwrap())?;

                if let Some(user) = user {
                    return Ok(user);
                }
                return Err(LogicError::UserNotLoggedIn.into());
            })
            .await?;

            match user {
                Ok(user) => Ok(CallerPrincipal{user}),
                Err(err) => Err(err).map_err(error::ErrorInternalServerError)
            }
        })
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let port: u16 = if args.len() >= 2 {
        args[1].parse::<u16>().unwrap()
    }
    else {
        8080
    };

    let bind_address: String = if args.len() >= 3 {
        args[2].clone()
    }
    else {
        "127.0.0.1".to_string()
    };

    create_db()?;

    let main_db_manager = SqliteConnectionManager::file("data/db.s3db");
    let main_db_pool = Pool::new(main_db_manager).unwrap();

    let users_passwords_db_manager = SqliteConnectionManager::file("data/user_passwords.s3db");
    let user_passwords_db_pool = Pool::new(users_passwords_db_manager).unwrap();

    let user_sessions_db_manager = SqliteConnectionManager::file("data/user_sessions.s3db");
    let user_sessions_db_pool = Pool::new(user_sessions_db_manager).unwrap();

    let db_storage = DbStorage {
        main_db_pool,
        user_passwords_db_pool,
        user_sessions_db_pool
    };

    let rng = web::Data::new(RandomGenerator{
        rng: Mutex::new(ChaCha20Rng::from_entropy())
    });

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(db_storage.clone()))
            .app_data(rng.clone())
            .route("/", web::get().to(index))
            .route("/forum", web::get().to(index))
            .route("/forum/{tail:.*}", web::get().to(index))
            .route("/articles", web::get().to(index))
            .route("/article/{tail:.*}", web::get().to(index))
            .route("/signup", web::get().to(index))
            .route("/js/bundle.min.js", web::get().to(js_bundle))
            .route("/css/style.css", web::get().to(style))
            .route("/css/icons.css", web::get().to(icons_css))
            .route("/fonts/icomoon.ttf", web::get().to(icons_ttf))
            .route("/fonts/icomoon.woff", web::get().to(icons_woff))
            .route("/fonts/icomoon.svg", web::get().to(icons_svg))
            .service(get_threads)
            .service(get_forum_structure)
            .service(get_messages)
            .service(get_search_messages)
            .service(get_current_user)
            .service(get_user_sessions)
            .service(get_uploaded_file)
            .service(post_thread)
            .service(post_message)
            .service(post_comment)
            .service(post_update_article_comment)
            .service(post_update_message)
            .service(post_new_section)
            .service(post_new_subsection)
            .service(post_upload)
            .service(post_rename_section)
            .service(post_rename_subsection)
            .service(post_rename_thread)
            .service(post_move_thread)
            .service(post_delete_thread)
            .service(post_move_subsection)
            .service(post_create_article)
            .service(post_update_article)
            .service(post_delete_article)
            .service(post_add_favorite_article)
            .service(post_remove_favorite_article)
            .service(get_articles)
            .service(get_favorite_articles)
            .service(get_article)
            .service(get_search_articles)
            .service(get_article_comments)
            .service(post_remove_user_session)
            .service(post_logout)
            .service(signon)
            .service(signup)
    })
        .bind((bind_address, port))?
        .run()
        .await
}

