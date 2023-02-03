use rusqlite::ToSql;
use rusqlite::types::{FromSql, FromSqlResult, ToSqlOutput, ValueRef};
use rusqlite::types::FromSqlError::InvalidType;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub enum ThreadsQueryType {
    All, Section, SubSection
}

#[derive(Deserialize)]
pub struct ThreadQuery {
    pub query_type: ThreadsQueryType,
    pub id: Option<u32>,
    pub page: u32,
}

#[derive(Serialize)]
pub struct ThreadQueryResult {
    pub threads: Vec<Thread>,
    pub count: u32,
}

#[derive(Serialize, Clone)]
pub struct User {
    pub id: u32,
    pub name: String,
}

#[derive(Serialize)]
pub struct Section {
    pub id: u32,
    pub name: String,
}

#[derive(Serialize)]
pub struct SubSection {
    pub id: u32,
    #[serde(rename = "sectionId")]
    pub section_id: u32,
    pub name: String,
}

#[derive(Serialize)]
pub struct ForumStructure {
    pub sections: Vec<Section>,
    #[serde(rename = "subSections")]
    pub subsections: Vec<SubSection>,
    #[serde(rename = "threadsPerPage")]
    pub threads_per_page: u32,
    #[serde(rename = "messagesPerPage")]
    pub messages_per_page: u32,
}

#[derive(Serialize)]
pub struct Thread {
    pub id: u32,
    #[serde(rename = "subSectionId")]
    pub sub_section_id: u32,
    pub name: String,
    pub author: User,
    #[serde(rename = "totalMessages")]
    pub total_messages: u32,
    #[serde(rename = "creationDateTime")]
    pub creation_date_time: u64,
    #[serde(rename = "lastMessageUser")]
    pub last_message_user: User,
    #[serde(rename = "lastMessageId")]
    pub last_message_id: u32,
    #[serde(rename = "lastMessageDateTime")]
    pub last_message_date_time: u64,
}

#[derive(Serialize)]
pub struct Message {
    pub id: u32,
    pub user: User,
    #[serde(rename = "threadId")]
    pub thread_id: u32,
    #[serde(rename = "createTime")]
    pub create_time: u64,
    #[serde(rename = "updateTime")]
    pub update_time: u64,
    pub content: String,
}

#[derive(Serialize)]
pub struct Comment {
    pub id: u32,
    pub user: User,
    #[serde(rename = "articleId")]
    pub acticle_id: u32,
    #[serde(rename = "createTime")]
    pub create_time: u64,
    #[serde(rename = "updateTime")]
    pub update_time: u64,
    pub content: String,
}

#[derive(Deserialize)]
pub struct PostNewSection {
    pub name: String,
}

#[derive(Deserialize)]
pub struct PostNewSubsection {
    pub name: String,
    #[serde(rename = "sectionId")]
    pub section_id: u32,
}

#[derive(Deserialize)]
pub struct RenameSection {
    pub name: String,
    #[serde(rename = "sectionId")]
    pub section_id: u32,
}

#[derive(Deserialize)]
pub struct RenameSubsection {
    pub name: String,
    #[serde(rename = "subsectionId")]
    pub subsection_id: u32,
}

#[derive(Deserialize)]
pub struct RenameThread {
    pub name: String,
    #[serde(rename = "threadId")]
    pub thread_id: u32,
}

#[derive(Deserialize)]
pub struct MoveThread {
    #[serde(rename = "threadId")]
    pub thread_id: u32,
    #[serde(rename = "newSubsectionId")]
    pub new_subsection_id: u32,
}

#[derive(Deserialize)]
pub struct DeleteThread {
    #[serde(rename = "threadId")]
    pub thread_id: u32,
}

#[derive(Deserialize)]
pub struct MoveSubsection {
    #[serde(rename = "subsectionId")]
    pub subsection_id: u32,
    #[serde(rename = "newSectionId")]
    pub new_section_id: u32,
}

#[derive(Deserialize)]
pub struct PostMessage {
    pub message: String,
    #[serde(rename = "threadId")]
    pub thread_id: u32,
}

#[derive(Deserialize)]
pub struct CreateThreadMessage {
    pub message: String,
    #[serde(rename = "threadName")]
    pub thread_name: String,
    #[serde(rename = "subsectionId")]
    pub subsection_id: u32,
}

#[derive(Deserialize)]
pub struct UpdateMessage {
    pub message: String,
    #[serde(rename = "messageId")]
    pub message_id: u32,
    #[serde(rename = "threadId")]
    pub thread_id: u32,
}

#[derive(Deserialize)]
pub struct UpdateComment {
    pub message: String,
    #[serde(rename = "commentId")]
    pub comment_id: u32,
    #[serde(rename = "articleId")]
    pub article_id: u32,
}

#[derive(Deserialize)]
pub struct MessageSearchParams {
    pub query: String,
}

#[derive(Deserialize)]
pub struct ArticleSearchParams {
    pub query: String,
}

#[derive(Serialize)]
pub struct MessageSearchResult {
    pub id: u32,
    #[serde(rename = "threadId")]
    pub thread_id: u32,
    #[serde(rename = "threadName")]
    pub thread_name: String,
    #[serde(rename = "createTime")]
    pub create_time: u64,
    pub user: User,
    pub content: String,
}

#[derive(Serialize)]
pub struct MessageSearchResults {
    pub messages: Vec<MessageSearchResult>,
}

#[derive(Serialize)]
pub struct UserSession {
    pub session: String,
}

#[derive(Serialize)]
pub struct UserSessions {
    pub sessions: Vec<UserSession>,
}

#[derive(Deserialize)]
pub struct SignOnParams {
    #[serde(rename = "userName")]
    pub user_name: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct SignUpParams {
    #[serde(rename = "userName")]
    pub user_name: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct RemoveSession {
    pub session: String,
}

#[derive(Deserialize)]
pub struct LogoutParams {
    #[serde(rename = "removeAllSessions")]
    pub remove_all_sessions: bool,
}

#[derive(Serialize)]
pub struct UploadedFile {
    pub id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub mime: String,
}

#[derive(Serialize)]
pub struct UploadedFiles {
    pub files: Vec<UploadedFile>,
}

pub struct UploadedFileWithLocation {
    pub file: UploadedFile,
    pub file_path: String,
}

#[derive(Debug, Clone)]
pub enum LogicError {
    CreateError,
    ArticleNotFound,
    SectionNotFound,
    SubsectionNotFound,
    ThreadNotFound,
    MessageNotFound,
    InvalidPass,
    NoSession,
    UserNotLoggedIn,
}

impl std::fmt::Display for LogicError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            LogicError::CreateError => {write!(f, "Create error")}
            LogicError::SectionNotFound => {write!(f, "Section not found")}
            LogicError::ArticleNotFound => {write!(f, "Article not found")}
            LogicError::SubsectionNotFound => {write!(f, "Subsection not found")}
            LogicError::ThreadNotFound => {write!(f, "Thread not found")}
            LogicError::MessageNotFound => {write!(f, "Message not found")}
            LogicError::InvalidPass => {write!(f, "Invalid pass")}
            LogicError::NoSession => {write!(f, "No session")}
            LogicError::UserNotLoggedIn => {write!(f, "User is not logged in")}
        }
    }
}

impl std::error::Error for LogicError {}

#[derive(Deserialize)]
pub struct MessagesQuery {
    #[serde(rename = "threadId")]
    pub thread_id: u32,
    pub page: u32,
}

#[derive(Serialize)]
pub struct MessagesQueryResult {
    pub thread: Thread,
    pub messages: Vec<Message>,
}

#[derive(Deserialize)]
pub struct CommentsQuery {
    #[serde(rename = "articleId")]
    pub article_id: u32,
    pub page: u32,
}

#[derive(Serialize)]
pub struct CommentsQueryResult {
    #[serde(rename = "articleInfo")]
    pub article_info: ArticleInfo,
    pub comments: Vec<Comment>,
    #[serde(rename = "totalComments")]
    pub total_comments: u32,
}

#[derive(Serialize)]
pub struct ArticleInfo {
    pub id: u32,
    pub path: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct Articles {
    pub articles: Vec<ArticleInfo>,
}

#[derive(Serialize)]
pub enum SearchResultFragment {
    Normal(String),
    Highlight(String)
}

#[derive(Serialize)]
pub struct ArticleSearchResult {
    pub info: ArticleInfo,
    pub text: Vec<SearchResultFragment>
}

#[derive(Serialize)]
pub struct ArticleSearchResults {
    pub articles: Vec<ArticleSearchResult>,
}

#[derive(Serialize)]
pub struct ArticleVersion {
    pub version: u32,
    #[serde(rename = "createTime")]
    pub create_time: u64,
    pub user: User,
    pub active: bool,
}

#[derive(Serialize, Deserialize, Copy, Clone)]
pub enum ArticleVisibility {
    #[serde(rename = "public")]
    Public,
    #[serde(rename = "private")]
    Private
}

#[derive(Deserialize)]
pub struct PostComment {
    pub message: String,
    #[serde(rename = "articleId")]
    pub article_id: u32,
    #[serde(rename = "articleVersion")]
    pub article_version: Option<u32>,
}

impl ToSql for ArticleVisibility {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        match self {
            ArticleVisibility::Public => Ok(ToSqlOutput::from("public")),
            ArticleVisibility::Private => Ok(ToSqlOutput::from("private"))
        }
    }
}

impl FromSql for ArticleVisibility {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        let str = value.as_str()?;
        match str {
            "public" => Ok(ArticleVisibility:: Public),
            "private" => Ok(ArticleVisibility:: Private),
            _ => Err(InvalidType)
        }
    }
}

#[derive(Serialize)]
pub struct Article {
    pub info: ArticleInfo,
    pub content: String,
    pub user: User,
    #[serde(rename = "createTime")]
    pub create_time: u64,
    pub version: u32,
    #[serde(skip_serializing)]
    pub content_id: Option<u64>,
    pub active: bool,
    #[serde(rename = "commentsCount")]
    pub comments_count: u32,
    pub visibility: ArticleVisibility,

    pub versions: Vec<ArticleVersion>,
}

#[derive(Deserialize)]
pub struct CreateArticle {
    pub path: String,
    pub name: String,
    pub content: String,
    pub visibility: ArticleVisibility,
}

#[derive(Deserialize)]
pub struct UpdateArticle {
    pub id: u32,
    pub path: String,
    pub name: String,
    pub content: String,
    pub visibility: ArticleVisibility,
}

#[derive(Deserialize)]
pub struct DeleteArticle {
    pub id: u32,
}

#[derive(Deserialize)]
pub struct AddFavoriteArticle {
    pub id: u32,
}

#[derive(Deserialize)]
pub struct RemoveFavoriteArticle {
    pub id: u32,
}

#[derive(Deserialize)]
pub struct GetArticle {
    pub id: u32,
    pub version: Option<u32>,
}
