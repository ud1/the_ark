use chrono::{Datelike, Timelike, Utc};
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{OptionalExtension, params, Row, TransactionBehavior};
use crate::{ForumStructure, Message, PostMessage, Section, SubSection, Thread, ThreadQuery, ThreadsQueryType, UploadedFile, User};
use pbkdf2::{
    password_hash::{
        PasswordHash,
        PasswordHasher, PasswordVerifier, rand_core::OsRng, SaltString
    },
    Pbkdf2
};
use crate::structs::{Article, ArticleInfo, Articles, ArticleSearchParams, ArticleSearchResult, ArticleSearchResults, ArticleVersion, ArticleVisibility, Comment, CommentsQueryResult, CreateThreadMessage, LogicError, MessageSearchParams, MessageSearchResult, MessageSearchResults, PostComment, SearchResultFragment, UpdateComment, UpdateMessage, UploadedFileWithLocation, UserSession, UserSessions};

pub type DbConnection = PooledConnection<SqliteConnectionManager>;
pub type QueryResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub const THREADS_PER_PAGE: u32 = 50;
pub const MESSAGES_PER_PAGE: u32 = 50;


pub fn query_forum_structure(conn: &DbConnection) -> QueryResult<ForumStructure> {
    let mut stmt = conn.prepare(
        "SELECT id, name FROM SECTION WHERE deleted = FALSE",
    )?;

    let mut sections = Vec::new();
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        sections.push(Section{
            id: row.get(0)?,
            name: row.get(1)?,
        });
    }

    let mut stmt = conn.prepare(
        "SELECT id, section_id, name FROM SUBSECTION WHERE deleted = FALSE AND (SELECT deleted FROM SECTION WHERE SUBSECTION.section_id = SECTION.id) = FALSE",
    )?;

    let mut subsections = Vec::new();
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        subsections.push(SubSection{
            id: row.get(0)?,
            section_id: row.get(1)?,
            name: row.get(2)?,
        });
    }

    Ok(ForumStructure{sections, subsections, threads_per_page: THREADS_PER_PAGE, messages_per_page: MESSAGES_PER_PAGE})
}

fn get_threads_sql(where_clause: &str, limit_clause: &str, offset_clause: &str) -> String {
    return format!("SELECT c.*, m2.create_time, u2.id, u2.name FROM (
SELECT t.id, t.subsection_id, tn.name, t.author_id, u.name, t.create_time,
(SELECT count(1) FROM MESSAGE m WHERE m.thread_id = t.id) as message_count,
(SELECT max(id) FROM MESSAGE m WHERE m.thread_id = t.id) as last_message_id,
t.update_time
FROM THREAD t INNER JOIN USER u on t.author_id = u.id INNER JOIN THREAD_NAME_FTS tn ON tn.rowid = t.name_id
{}
) c INNER JOIN MESSAGE m2 ON m2.id = c.last_message_id AND m2.thread_id = c.id
INNER JOIN USER u2 on m2.user_id = u2.id
order by c.update_time DESC
 {} {}", where_clause, limit_clause, offset_clause);
}

fn extract_thread(row: &Row) -> Result<Thread, Box<dyn std::error::Error + Send + Sync>> {
    Ok(Thread {
        id: row.get(0)?,
        sub_section_id: row.get(1)?,
        name: row.get(2)?,
        author: User {
            id: row.get(3)?,
            name: row.get(4)?,
        },
        creation_date_time: row.get(5)?,
        total_messages: row.get(6)?,
        last_message_id: row.get(7)?,
        last_message_date_time: row.get(9)?,
        last_message_user: User {
            id: row.get(10)?,
            name: row.get(11)?,
        },
    })
}

pub fn get_thread_where_clause(params: &ThreadQuery) -> &str {
    return match params.query_type {
        ThreadsQueryType::All => "WHERE deleted = FALSE",
        ThreadsQueryType::Section => "WHERE deleted = FALSE AND t.subsection_id IN (SELECT ID FROM SUBSECTION WHERE section_id = ?)",
        ThreadsQueryType::SubSection => "WHERE deleted = FALSE AND t.subsection_id = ?"
    };
}

pub fn query_threads(conn: &DbConnection, params: &ThreadQuery) -> QueryResult<Vec<Thread>> {
    let where_clause = get_thread_where_clause(params);

    let limit_clause = format!(" LIMIT {}", THREADS_PER_PAGE);
    let offset_clause = if params.page > 1 {format!(" OFFSET {}", (params.page - 1) * THREADS_PER_PAGE)} else { "".to_string() };

    let sql = get_threads_sql(where_clause, &limit_clause, &offset_clause);

    let mut stmt = conn.prepare(
        &sql,
    )?;

    let mut threads = Vec::new();

    let mut rows = if let ThreadsQueryType::All = params.query_type { stmt.query([])? } else { stmt.query([params.id])? };

    while let Some(row) = rows.next()? {
        let thread = extract_thread(row)?;
        threads.push(thread);
    }

    Ok(threads)
}

pub fn query_thread_count(conn: &DbConnection, params: &ThreadQuery) -> QueryResult<u32> {
    let where_clause = get_thread_where_clause(params);

    let sql = format!("SELECT count(1) FROM THREAD t {}", where_clause);

    let mut stmt = conn.prepare(
        &sql,
    )?;

    let count: u32 = if let ThreadsQueryType::All = params.query_type { stmt.query_row([], |rs| rs.get(0))? } else { stmt.query_row([params.id], |rs| rs.get(0))? };

    Ok(count)
}

pub fn query_thread(conn: &DbConnection, thread_id: u32) -> QueryResult<Option<Thread>> {
    let sql = get_threads_sql(" WHERE t.id = ? ", "", "");

    let mut stmt = conn.prepare(
        &sql,
    )?;

    let mut rows = stmt.query([thread_id])?;

    if let Some(row) = rows.next()? {
        return Ok(Some(extract_thread(row)?));
    }

    return Ok(None);
}

pub fn query_thread_messages(conn: &DbConnection, thread_id: u32, page: u32) -> QueryResult<Vec<Message>> {
    let limit_clause = format!(" LIMIT {}", MESSAGES_PER_PAGE);
    let offset_clause = if page > 1 {format!(" OFFSET {}", (page - 1) * MESSAGES_PER_PAGE)} else { "".to_string() };

    let sql = format!("SELECT * FROM (
SELECT m.id, m.user_id, u.name, m.create_time, m.update_time, mc.content
FROM MESSAGE m
INNER JOIN USER u ON u.id = m.user_id
INNER JOIN MESSAGE_CONTENT_FTS mc ON mc.rowid = m.content_id
WHERE thread_id = ?
ORDER BY m.id
)
{} {}
", limit_clause, offset_clause);
    let mut stmt = conn.prepare(
        &sql,
    )?;

    let mut rows = stmt.query([thread_id])?;

    let mut messages = Vec::new();

    while let Some(row) = rows.next()? {
        let message = Message {
            id: row.get(0)?,
            user: User {
                id: row.get(1)?,
                name: row.get(2)?,
            },
            thread_id: thread_id,
            create_time: row.get(3)?,
            update_time: row.get(4)?,
            content: row.get(5)?,
        };

        messages.push(message);
    }

    Ok(messages)
}

pub fn query_article_comments(conn: &DbConnection, article_id: u32, page: u32, user: &Option<User>) -> QueryResult<CommentsQueryResult> {
    let limit_clause = format!(" LIMIT {}", MESSAGES_PER_PAGE);
    let offset_clause = if page > 1 {format!(" OFFSET {}", (page - 1) * MESSAGES_PER_PAGE)} else { "".to_string() };

    let sql = format!("SELECT * FROM (
SELECT m.id, m.user_id, u.name, m.create_time, m.update_time, mc.content
FROM ARTICLE_COMMENT m
INNER JOIN USER u ON u.id = m.user_id
INNER JOIN ARTICLE_COMMENT_CONTENT_FTS mc ON mc.rowid = m.content_id
WHERE article_id = ?
ORDER BY m.id
)
{} {}
", limit_clause, offset_clause);
    let mut stmt = conn.prepare(
        &sql,
    )?;

    let mut rows = stmt.query([article_id])?;

    let mut comments = Vec::new();

    while let Some(row) = rows.next()? {
        let message = Comment {
            id: row.get(0)?,
            user: User {
                id: row.get(1)?,
                name: row.get(2)?,
            },
            acticle_id: article_id,
            create_time: row.get(3)?,
            update_time: row.get(4)?,
            content: row.get(5)?,
        };

        comments.push(message);
    }

    let sql = "SELECT count(1) FROM ARTICLE_COMMENT WHERE article_id = ?";
    let mut stmt = conn.prepare(
        &sql,
    )?;

    let total_comments: u32 = stmt.query_row([article_id], |r| r.get(0))?;

    let mut stmt = conn.prepare(
        &format!("SELECT a.id, a.path, (SELECT name FROM ARTICLE_CONTENT_FTS WHERE ARTICLE_CONTENT_FTS.rowid = a.content_id) FROM ARTICLE a \
            WHERE a.active = TRUE AND {} AND a.id = ?", article_visibility_restriction(user)),
    )?;

    let mut rows = if user.is_some() {stmt.query(params![user.as_ref().unwrap().id, article_id])?} else {stmt.query([article_id])?};

    if let Some(row) = rows.next()? {
        let article = ArticleInfo {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
        };

        return Ok(CommentsQueryResult{
            article_info: article,
            comments,
            total_comments
        });
    }

    Err(LogicError::ArticleNotFound.into())
}

pub fn create_section(conn: &DbConnection, section_name: &String) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "INSERT INTO SECTION(name) VALUES(?)",
    )?;

    let count = stmt.execute([section_name])?;
    if count == 0 {
        return Err(LogicError::CreateError.into());
    }

    return Ok(());
}

pub fn create_sub_section(conn: &DbConnection, section_id: u32, section_name: &String) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "INSERT INTO SUBSECTION(section_id, name) VALUES(?, ?)",
    )?;

    let count = stmt.execute(params![section_id, section_name])?;
    if count == 0 {
        return Err(LogicError::CreateError.into());
    }

    return Ok(());
}

pub fn rename_section(conn: &DbConnection, section_id: u32, section_name: &String) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "UPDATE SECTION SET name = ? WHERE id = ?",
    )?;

    let count = stmt.execute(params![section_name, section_id])?;
    if count == 0 {
        return Err(LogicError::SectionNotFound.into());
    }

    return Ok(());
}

pub fn rename_subsection(conn: &DbConnection, subsection_id: u32, section_name: &String) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "UPDATE SUBSECTION SET name = ? WHERE id = ?",
    )?;

    let count = stmt.execute(params![section_name, subsection_id])?;
    if count == 0 {
        return Err(LogicError::SubsectionNotFound.into());
    }

    return Ok(());
}

pub fn rename_thread(conn: &DbConnection, thread_id: u32, thread_name: &String) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "UPDATE THREAD_NAME_FTS SET name = ? WHERE rowid = (SELECT name_id FROM THREAD WHERE id = ?)",
    )?;

    let count = stmt.execute(params![thread_name, thread_id])?;
    if count == 0 {
        return Err(LogicError::ThreadNotFound.into());
    }

    return Ok(());
}

pub fn move_thread(conn: &DbConnection, thread_id: u32, new_subsection_id: u32) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "UPDATE THREAD SET subsection_id = ? WHERE id = ?",
    )?;

    let count = stmt.execute(params![new_subsection_id, thread_id])?;
    if count == 0 {
        return Err(LogicError::ThreadNotFound.into());
    }

    return Ok(());
}

pub fn move_subsection(conn: &DbConnection, subsection_id: u32, new_section_id: u32) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "UPDATE SUBSECTION SET section_id = ? WHERE id = ?",
    )?;

    let count = stmt.execute(params![new_section_id, subsection_id])?;
    if count == 0 {
        return Err(LogicError::SubsectionNotFound.into());
    }

    return Ok(());
}

pub fn find_user(conn: &DbConnection, user_name: &str) -> QueryResult<Option<User>> {
    let mut stmt = conn.prepare(
        "SELECT id, name FROM USER WHERE name = ?",
    )?;

    let mut rows = stmt.query([user_name])?;

    if let Some(row) = rows.next()? {
        return Ok(Some(User{
            id: row.get(0)?,
            name: row.get(1)?
        }));
    }

    return Ok(None);
}

pub fn verify_user_password(pass_conn: &DbConnection, user: &User, pass_hex: &str) -> QueryResult<bool> {
    let decoded_pass = hex::decode(pass_hex);
    if !decoded_pass.is_ok() {
        return Ok(false);
    }

    let decoded_pass = decoded_pass.unwrap();

    let mut stmt = pass_conn.prepare(
        "SELECT password FROM USER_PASS WHERE id = ?",
    )?;

    let mut rows = stmt.query([user.id])?;

    if let Some(row) = rows.next()? {
        let password: String = row.get(0)?;

        let parsed_hash = PasswordHash::new(&password);
        if !parsed_hash.is_ok() {
            return Ok(false);
        }

        if !Pbkdf2.verify_password(&decoded_pass, &parsed_hash.unwrap()).is_ok() {
            return Ok(false);
        }

        return Ok(true);
    }

    return Ok(false);
}

pub fn save_user(conn: &DbConnection, user_name: &str) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "INSERT INTO USER(name) VALUES(?)",
    )?;

    let count = stmt.execute([user_name])?;
    if count == 0 {
        return Err(LogicError::CreateError.into());
    }

    return Ok(());
}

pub fn save_user_password(pass_conn: &DbConnection, user: &User, pass_hex: &str) -> QueryResult<()> {
    let decoded_pass = hex::decode(pass_hex);
    if !decoded_pass.is_ok() {
        return Err(LogicError::InvalidPass.into());
    }

    let decoded_pass = decoded_pass.unwrap();

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Pbkdf2.hash_password(&decoded_pass, &salt);
    if !password_hash.is_ok() {
        return Err(LogicError::CreateError.into());
    }

    let password_hash = password_hash.unwrap().to_string();

    let mut stmt = pass_conn.prepare(
        "INSERT OR REPLACE INTO USER_PASS(id, password) VALUES(?, ?)",
    )?;

    stmt.execute(params![user.id, password_hash])?;
    return Ok(());
}

pub fn save_user_session(user_sessions_conn: &DbConnection, user: &User, session: &str) -> QueryResult<()> {
    let mut stmt = user_sessions_conn.prepare(
        "INSERT OR REPLACE INTO USER_SESSION(user_id, user_session) VALUES(?, ?)",
    )?;

    stmt.execute(params![user.id, session])?;
    return Ok(());
}

pub fn save_message(conn: &mut DbConnection, message: &PostMessage, user: &User) -> QueryResult<()> {
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;

    let seq: Option<u32> = transaction.query_row("SELECT message_seq FROM THREAD WHERE id = ?", [message.thread_id], |row| row.get(0)).optional()?;

    if seq.is_none() {
        return Err(LogicError::ThreadNotFound.into());
    }

    let seq = seq.unwrap() + 1;
    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    transaction.execute("INSERT INTO MESSAGE_CONTENT_FTS(content) VALUES(?)",
                        params![&message.message])?;

    let message_content_id = transaction.last_insert_rowid() as u32;

    transaction.execute("INSERT INTO MESSAGE(id, user_id, thread_id, create_time, update_time, content_id) VALUES(?, ?, ?, ?, ?, ?)",
                        params![seq, user.id, message.thread_id, t, t, message_content_id])?;

    transaction.execute("UPDATE THREAD SET update_time = ?, message_seq = ? WHERE id = ?",
                        params![t, seq, message.thread_id])?;

    transaction.commit()?;
    return Ok(());
}

pub fn save_comment(conn: &mut DbConnection, message: &PostComment, user: &User) -> QueryResult<()> {
    let article = query_article(&conn, message.article_id, message.article_version, &Some(user.clone()))?;

    let transaction = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;

    let seq: u32 = transaction.query_row("SELECT COUNT(1) FROM ARTICLE_COMMENT WHERE article_id = ?", [message.article_id], |row| row.get(0))?;

    let seq = seq + 1;
    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    transaction.execute("INSERT INTO ARTICLE_COMMENT_CONTENT_FTS(content) VALUES(?)",
                        params![&message.message])?;

    let comment_content_id = transaction.last_insert_rowid() as u32;

    transaction.execute("INSERT INTO ARTICLE_COMMENT(id, user_id, article_id, article_version, create_time, update_time, content_id) VALUES(?, ?, ?, ?, ?, ?, ?)",
                        params![seq, user.id, message.article_id, article.version, t, t, comment_content_id])?;

    transaction.commit()?;
    return Ok(());
}

pub fn create_thread(conn: &mut DbConnection, message: &CreateThreadMessage, user: &User) -> QueryResult<()> {
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;

    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    transaction.execute("INSERT INTO THREAD_NAME_FTS(name) VALUES(?)",
                        params![message.thread_name]
    )?;

    let thread_name_id = transaction.last_insert_rowid() as u32;

    transaction.execute("INSERT INTO THREAD(subsection_id, name_id, author_id, create_time, update_time, message_seq) VALUES(?, ?, ?, ?, ?, ?)",
                        params![message.subsection_id, thread_name_id, user.id, t, t, 1u32]
    )?;

    let thread_id = transaction.last_insert_rowid() as u32;

    transaction.execute("INSERT INTO MESSAGE_CONTENT_FTS(content) VALUES(?)",
                        params![&message.message])?;

    let message_content_id = transaction.last_insert_rowid() as u32;

    transaction.execute("INSERT INTO MESSAGE(id, user_id, thread_id, create_time, update_time, content_id) VALUES(?, ?, ?, ?, ?, ?)",
                        params![1u32, user.id, thread_id, t, t, message_content_id])?;

    transaction.commit()?;
    return Ok(());
}

pub fn update_message(conn: &mut DbConnection, message: &UpdateMessage, user: &User) -> QueryResult<()> {
    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    let count = conn.execute("UPDATE MESSAGE_CONTENT_FTS SET content = ? WHERE rowid = (SELECT content_id FROM MESSAGE WHERE id = ? AND thread_id = ?)",
                             params![message.message, message.message_id, message.thread_id])?;

    if count == 0 {
        return Err(LogicError::MessageNotFound.into());
    }

    let count = conn.execute("UPDATE MESSAGE SET update_time = ? WHERE id = ? AND thread_id = ? AND user_id = ?",
                             params![t, message.message_id, message.thread_id, user.id])?;

    if count == 0 {
        return Err(LogicError::MessageNotFound.into());
    }

    return Ok(());
}

pub fn update_comment(conn: &mut DbConnection, message: &UpdateComment, user: &User) -> QueryResult<()> {
    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    let count = conn.execute("UPDATE ARTICLE_COMMENT_CONTENT_FTS SET content = ? WHERE rowid = (SELECT content_id FROM ARTICLE_COMMENT WHERE id = ? AND article_id = ?)",
                             params![message.message, message.comment_id, message.article_id])?;

    if count == 0 {
        return Err(LogicError::MessageNotFound.into());
    }

    let count = conn.execute("UPDATE ARTICLE_COMMENT SET update_time = ? WHERE id = ? AND article_id = ? AND user_id = ?",
                             params![t, message.comment_id, message.article_id, user.id])?;

    if count == 0 {
        return Err(LogicError::MessageNotFound.into());
    }

    return Ok(());
}

pub fn query_user_by_session(conn: &DbConnection, user_sessions_conn: &DbConnection, session: &str) -> QueryResult<Option<User>> {
    let user_id: Option<u32> = user_sessions_conn.query_row("SELECT user_id from USER_SESSION where user_session = ?", [session], |row| row.get(0))
        .optional()?;

    if user_id.is_none() {
        return Ok(None);
    }

    let user_id = user_id.unwrap();

    let user: Option<User> = conn.query_row("SELECT id, name from USER where id = ?", [user_id],
                                            |row| Ok(User{id: row.get(0)?, name: row.get(1)?}))
        .optional()?;

    Ok(user)
}

pub fn query_messages_by_search_params(conn: &DbConnection, params: &MessageSearchParams) -> QueryResult<MessageSearchResults> {
    let sql = "SELECT
m.id,
m.thread_id, tn.name,
m.create_time,
m.user_id, u.name,
mc.content
FROM MESSAGE_CONTENT_FTS mc
INNER JOIN MESSAGE m ON m.content_id = mc.rowid
INNER JOIN USER u ON u.id = m.user_id
INNER JOIN THREAD t ON t.id = m.thread_id AND t.deleted = FALSE
INNER JOIN THREAD_NAME_FTS tn ON tn.rowid = t.name_id
WHERE MESSAGE_CONTENT_FTS MATCH ?
ORDER BY mc.rank
LIMIT 100";

    let mut stmt = conn.prepare(
        &sql,
    )?;

    let mut rows = stmt.query([reformat_fts_query(&params.query)])?;

    let mut messages = Vec::new();

    while let Some(row) = rows.next()? {
        let message = MessageSearchResult {
            id: row.get(0)?,
            thread_id: row.get(1)?,
            thread_name: row.get(2)?,
            create_time: row.get(3)?,
            user: User {
                id: row.get(4)?,
                name: row.get(5)?,
            },
            content: row.get(6)?,
        };

        messages.push(message);
    }

    Ok(MessageSearchResults{messages})
}

pub fn query_sessions(user_sessions_conn: &DbConnection, session: &str) -> QueryResult<UserSessions> {
    let mut stmt = user_sessions_conn.prepare(
        "SELECT user_session FROM USER_SESSION WHERE user_id = (SELECT user_id FROM USER_SESSION WHERE user_session = ?)",
    )?;

    let mut rows = stmt.query([session])?;

    let mut sessions = Vec::new();

    while let Some(row) = rows.next()? {
        let session: String = row.get(0)?;
        sessions.push(UserSession{session});
    }

    return Ok(UserSessions{sessions});
}

pub fn remove_session(user_sessions_conn: &DbConnection, current_session: &str, session_to_remove: &str) -> QueryResult<UserSessions> {
    let mut stmt = user_sessions_conn.prepare(
        "DELETE FROM USER_SESSION WHERE user_id = (SELECT user_id FROM USER_SESSION WHERE user_session = ?) AND user_session = ?",
    )?;

    stmt.execute(params![current_session, session_to_remove])?;

    return query_sessions(user_sessions_conn, current_session);
}

pub fn remove_all_sessions(user_sessions_conn: &DbConnection, current_session: &str) -> QueryResult<()> {
    let mut stmt = user_sessions_conn.prepare(
        "DELETE FROM USER_SESSION WHERE user_id = (SELECT user_id FROM USER_SESSION WHERE user_session = ?)",
    )?;

    stmt.execute(params![current_session])?;

    return Ok(());
}

pub fn save_file_mapping(conn: &DbConnection, file_name: &str, mime: &str, orig_file_name: &str, user: &User, i: u32) -> QueryResult<String> {
    let now = Utc::now();
    let id = format!(
        "u{}f{:04}{:02}{:02}T{:02}{:02}{:02}{:03}i{}",
        user.id,
        now.year(),
        now.month(),
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
        now.nanosecond() / 1000_000,
        i
    );

    let mut stmt = conn.prepare(
        "INSERT OR REPLACE INTO FILES(id, user_id, file_name, mime, orig_file_name) VALUES(?, ?, ?, ?, ?)",
    )?;

    stmt.execute(params![id, user.id, file_name, mime, orig_file_name])?;

    return Ok(id);
}

pub fn query_file(conn: &DbConnection, id: String) -> QueryResult<UploadedFileWithLocation> {
    let mut stmt = conn.prepare(
        "SELECT orig_file_name, mime, file_name FROM FILES WHERE id = ?",
    )?;

    let file = stmt.query_row(params![id], |r| Ok(UploadedFileWithLocation{
        file: UploadedFile{id: id.to_string(), file_name: r.get(0)?, mime: r.get(1)?}, file_path: r.get(2)?}))?;

    Ok(file)
}

pub fn delete_thread(conn: &mut DbConnection, id: u32) -> QueryResult<()> {
    let mut stmt = conn.prepare("UPDATE THREAD SET deleted = TRUE WHERE id = ?")?;
    stmt.execute([id])?;

    return Ok(());
}

pub fn create_article(conn: &mut DbConnection, path: &str, name: &str, content: &str, visibility: ArticleVisibility, user: &User) -> QueryResult<()> {
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;

    let max_id: Option<u32> = transaction.query_row("SELECT MAX(id) FROM ARTICLE", [], |row| row.get(0))?;
    let id = max_id.unwrap_or(0) + 1;

    transaction.execute("INSERT INTO ARTICLE_CONTENT_FTS(name, content) VALUES(?, ?)",
                        params![name, content]
    )?;

    let content_id = transaction.last_insert_rowid() as u32;

    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    transaction.execute("INSERT INTO ARTICLE(id, path, content_id, user_id, create_time, version, active, visibility) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                        params![id, path, content_id, user.id, t, 1u32, true, visibility])?;

    transaction.commit()?;
    return Ok(());
}

pub fn update_article(conn: &mut DbConnection, id: u32, path: &str, name: &str, content: &str, visibility: ArticleVisibility, user: User) -> QueryResult<()> {
    let user_id = user.id;

    let article = query_article(&conn, id, None, &Some(user))?;

    if article.content_id.is_none() {
        return Err(LogicError::ArticleNotFound.into());
    }

    let transaction = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;

    let max_version: Option<u32> = transaction.query_row("SELECT MAX(version) FROM ARTICLE WHERE id = ?", [id], |row| row.get(0)).optional()?;

    if max_version.is_none() {
        return Err(LogicError::ArticleNotFound.into());
    }

    let version = max_version.unwrap() + 1;

    transaction.execute("UPDATE ARTICLE
SET active = FALSE,
name = ?,
content = ?,
content_id = NULL
WHERE id = ? AND active = TRUE",
    params![article.info.name, article.content, id]
    )?;

    transaction.execute("UPDATE ARTICLE_CONTENT_FTS SET name = ?, content = ? WHERE rowid = ?",
                        params![name, content, article.content_id.unwrap()]
    )?;

    let t = chrono::offset::Utc::now();
    let t = t.timestamp_millis();

    transaction.execute("INSERT INTO ARTICLE(id, path, content_id, user_id, create_time, version, active, visibility) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                        params![id, path, article.content_id.unwrap(), user_id, t, version, true, visibility])?;

    transaction.commit()?;
    return Ok(());
}

pub fn article_visibility_restriction(user: &Option<User>) -> &str {
    if user.is_some() {
        "(a.visibility = 'public' OR a.user_id = ?)"
    } else {
        "a.visibility = 'public'"
    }
}

pub fn query_articles(conn: &DbConnection, user: &Option<User>) -> QueryResult<Articles> {
    let mut stmt = conn.prepare(
        &format!("SELECT a.id, a.path, (SELECT name FROM ARTICLE_CONTENT_FTS WHERE ARTICLE_CONTENT_FTS.rowid = a.content_id) FROM ARTICLE a \
            WHERE a.active = TRUE AND {}", article_visibility_restriction(user)),
    )?;

    let mut rows = if user.is_some() {stmt.query(params![user.as_ref().unwrap().id])?} else {stmt.query([])?};

    let mut articles = Vec::new();

    while let Some(row) = rows.next()? {
        let article = ArticleInfo {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
        };

        articles.push(article);
    }

    return Ok(Articles{articles});
}

pub fn parse_search_result_text(text: String) -> Vec<SearchResultFragment> {
    let text = text.lines().filter(|l| l.contains("<<%%>>")).collect::<Vec<&str>>().join(". ");

    println!("{}", text);

    let mut result = Vec::new();
    let mut last = 0;
    let mut matched_count = 0;
    for (index, matched) in text.match_indices("<<%%>>") {
        if last != index {
            if matched_count % 2 == 1 {
                result.push(SearchResultFragment::Highlight(text[last..index].to_string()));
            }
            else {
                result.push(SearchResultFragment::Normal(text[last..index].to_string()));
            }
        }
        matched_count = matched_count + 1;
        last = index + matched.len();
    }
    if last < text.len() {
        result.push(SearchResultFragment::Normal(text[last..].to_string()));
    }

    return result;
}

pub fn query_articles_by_search_params(conn: &DbConnection, params: &ArticleSearchParams, user: &Option<User>) -> QueryResult<ArticleSearchResults> {
    let mut stmt = conn.prepare(
        &format!("SELECT a.id, a.path, c.name, highlight(ARTICLE_CONTENT_FTS, 1, '<<%%>>', '<<%%>>') \
        FROM ARTICLE a \
        INNER JOIN ARTICLE_CONTENT_FTS c ON c.rowid = a.content_id
        WHERE a.active = TRUE \
        AND ARTICLE_CONTENT_FTS MATCH ? \
        AND {}
        ORDER BY c.rank \
        LIMIT 100", article_visibility_restriction(user)),
    )?;

    let query = reformat_fts_query(&params.query);
    let mut rows = if user.is_some() {stmt.query(params![query, user.as_ref().unwrap().id])?} else {stmt.query([query])?};

    let mut articles = Vec::new();

    while let Some(row) = rows.next()? {
        let message = ArticleSearchResult {
            info: ArticleInfo {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
            },
            text: parse_search_result_text(row.get(3)?)
        };

        articles.push(message);
    }

    Ok(ArticleSearchResults{articles})
}

pub fn query_article(conn: &DbConnection, id: u32, version: Option<u32>, user: &Option<User>) -> QueryResult<Article> {
    let mut stmt = conn.prepare(
        &format!("SELECT a.version, a.create_time, a.user_id, (SELECT name FROM USER WHERE USER.id = a.user_id), active \
    FROM ARTICLE a \
    WHERE a.id = ? \
    AND {}
    ORDER BY a.create_time DESC", article_visibility_restriction(user)))?;

    let mut rows = if user.is_some() {stmt.query(params![id, user.as_ref().unwrap().id])?} else {stmt.query([id])?};
    let mut versions = Vec::new();

    while let Some(row) = rows.next()? {
        versions.push(ArticleVersion{
            version: row.get(0)?,
            create_time: row.get(1)?,
            user: User {
                id: row.get(2)?,
                name: row.get(3)?
            },
            active: row.get(4)?
        });
    }

    if versions.is_empty() {
        return Err(LogicError::ArticleNotFound.into());
    }

    let sql = if version.is_some() {
        "SELECT a.id, a.path, a.name, a.content, u.id, u.name, a.create_time, a.version, a.content_id, a.active, \
        (SELECT COUNT(1) FROM ARTICLE_COMMENT WHERE article_id = a.id), \
        a.visibility FROM ARTICLE a \
        INNER JOIN USER u ON u.id = a.user_id \
        WHERE a.id = ? AND a.version = ? AND a.active = FALSE"
    }
    else {
        "SELECT a.id, a.path, c.name, c.content, u.id, u.name, a.create_time, a.version, a.content_id, a.active, \
        (SELECT COUNT(1) FROM ARTICLE_COMMENT WHERE article_id = a.id), \
        a.visibility FROM ARTICLE a \
        INNER JOIN ARTICLE_CONTENT_FTS c ON c.rowid = a.content_id \
        INNER JOIN USER u ON u.id = a.user_id \
        WHERE a.id = ? AND a.active = TRUE"
    };

    let mut stmt = conn.prepare(&sql)?;

    let mut rows = if version.is_some() {stmt.query( params![id, version])} else {stmt.query(params![id])}?;

    if let Some(row) = rows.next()? {
        let article = Article {
            info: ArticleInfo {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
            },
            content: row.get(3)?,
            user: User {
                id: row.get(4)?,
                name: row.get(5)?,
            },
            create_time: row.get(6)?,
            version: row.get(7)?,
            content_id: row.get(8)?,
            active: row.get(9)?,
            comments_count: row.get(10)?,
            visibility: row.get(11)?,
            versions
        };

        return Ok(article);
    }

    return Err(LogicError::ArticleNotFound.into());
}

pub fn delete_article(conn: &mut DbConnection, id: u32, user: &Option<User>) -> QueryResult<()> {
    let article = query_article(&conn, id, None, user)?;

    if article.content_id.is_none() {
        return Err(LogicError::ArticleNotFound.into());
    }

    let transaction = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;

    transaction.execute("UPDATE ARTICLE
SET active = FALSE,
name = ?,
content = ?,
content_id = NULL
WHERE id = ? AND active = TRUE",
                        params![article.info.name, article.content, id]
    )?;

    transaction.execute("DELETE FROM ARTICLE_CONTENT_FTS WHERE rowid = ?",
                        params![article.content_id.unwrap()]
    )?;

    transaction.commit()?;
    return Ok(());
}

pub fn query_favorite_articles(conn: &DbConnection, user: &User) -> QueryResult<Articles> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.path, (SELECT name FROM ARTICLE_CONTENT_FTS WHERE ARTICLE_CONTENT_FTS.rowid = a.content_id) FROM ARTICLE a \
            INNER JOIN FAVORITE_ARTICLE fa ON fa.article_id = a.id
            WHERE a.active = TRUE AND (a.visibility = 'public' OR a.user_id = ?) AND fa.user_id = ?",
    )?;

    let mut rows = stmt.query(params![user.id, user.id])?;

    let mut articles = Vec::new();

    while let Some(row) = rows.next()? {
        let article = ArticleInfo {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
        };

        articles.push(article);
    }

    return Ok(Articles{articles});
}

pub fn add_favorite_article(conn: &mut DbConnection, user: &User, article_id: u32) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO FAVORITE_ARTICLE(article_id, user_id) VALUES(?, ?)",
    )?;

    stmt.execute(params![article_id, user.id])?;
    return Ok(());
}

pub fn remove_favorite_article(conn: &mut DbConnection, user: &User, article_id: u32) -> QueryResult<()> {
    let mut stmt = conn.prepare(
        "DELETE FROM FAVORITE_ARTICLE WHERE article_id = ? AND user_id = ?",
    )?;

    stmt.execute(params![article_id, user.id])?;
    return Ok(());
}

pub fn reformat_fts_query(query: &str) -> String {
    let query = query.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_' && c != '*' && c != '"', " ");

    let mut strings = Vec::new();
    let mut is_quoted = false;
    let mut accum: String = "".to_string();

    for s in query.split_whitespace() {
        let mut s: String = s.to_string();

        if !is_quoted {
            if s.contains('"') && !s.starts_with('"') {
                s = s.replace(|c: char| c == '"', "");
            }

            if s.starts_with('"') {
                if s.ends_with('"') {
                    strings.push(s);
                }
                else {
                    accum = s;
                    is_quoted = true;
                }
            }
            else {
                if s.contains('-') {
                    strings.push(format!("\"{}\"", s));
                }
                else {
                    strings.push(s);
                }
            }
        }
        else {
            if s.contains('"') && !s.ends_with('"') {
                s = s.replace(|c: char| c == '"', "");
            }

            if s.ends_with('"') {
                strings.push(format!("{} {}", accum, s));
                accum = "".to_string();
                is_quoted = false;
            }
            else {
                accum = format!("{} {}", accum, s);
            }
        }
    }

    if is_quoted {
        strings.push(format!("{}\"", accum));
    }

    return strings.join(" ");
}

#[cfg(test)]
mod tests {
    use crate::queries::reformat_fts_query;

    #[test]
    fn it_works() {
        assert_eq!("Test query", reformat_fts_query("Test query"));
        assert_eq!("\"Test query\"", reformat_fts_query("\"Test query\""));
        assert_eq!("Test AND query", reformat_fts_query("Test AND query"));
        assert_eq!("\"Test-123\" NOT query*", reformat_fts_query("Test-123 NOT query*"));
    }
}