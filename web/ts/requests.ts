import {catchError, EMPTY, from, Observable, of, startWith, switchMap} from "rxjs";
import {ajax, AjaxResponse} from "rxjs/ajax";
import {PageAddress, ROOT_PATH, SECTION_PATH, SUBSECTION_PATH} from "./router";
import Cookies from "js-cookie";

export interface User {
    id: number,
    name: string;
}

export interface Section {
    id: number,
    name: string,
}

export interface SubSection {
    id: number,
    sectionId: number,
    name: string,
}

export interface Thread {
    id: number,
    subSectionId: number,
    name: string,
    author: User,
    totalMessages: number,
    creationDateTime: number,
    lastMessageUser: User,
    lastMessageId: number,
    lastMessageDateTime: number,
}

export interface Message {
    id: number,
    user: User,
    threadId: number,
    createTime: number,
    updateTime: number,
    content: string,
}

export interface Comment {
    id: number,
    user: User,
    articleId: number,
    createTime: number,
    updateTime: number,
    content: string,
}

export interface ForumStructure {
    sections: Section[],
    subSections: SubSection[],
    threadsPerPage: number,
    messagesPerPage: number,
}

export type Result<T> = {result: T} | {error: string} | {inProgress: true};

export function mapResult<T>(r: Response): Promise<Result<T>> {
    if (r.ok)
        return r.json().then((j: T) => ({result: j}));

    return r.text().then(t => ({error: t}));
}

export function fromPromise<T>(promise: Promise<Result<T>>) {
    return from(promise).pipe(
        startWith({inProgress: true as const}),
        catchError(err => {
            console.error(err);
            return of({error: "Unexpected error"})
        })
    );
}

export function filterErrors<T>(v : AjaxResponse<T>): Observable<T> {
    if (v.status == 200)
        return of(v.response);

    return EMPTY;
}

export function queryForumStructure() {
    return ajax.getJSON<ForumStructure>("/api/structure");
}

export interface ThreadQueryResult {
    threads: Thread[],
    count: number
}

export function ajaxGet<T>(url: string) : Observable<Result<T>> {
    return fromPromise(
        fetch(url, {credentials: "include"}).then(mapResult<T>)
    );
}

export function queryThreads(address: PageAddress) {
    if (address.template == ROOT_PATH)
        return ajaxGet<ThreadQueryResult>(`/api/threads?query_type=All&page=${address.params.page || 1}`);
    else if (address.template == SECTION_PATH)
        return ajaxGet<ThreadQueryResult>(`/api/threads?query_type=Section&id=${address.sectionId}&page=${address.params.page || 1}`);
    else if (address.template == SUBSECTION_PATH)
        return ajaxGet<ThreadQueryResult>(`/api/threads?query_type=SubSection&id=${address.subSectionId}&page=${address.params.page || 1}`);
    else
        return EMPTY;
}

const SESSION_COOKIE = "SESSION";

export function getSessionCookie() {
    return Cookies.get(SESSION_COOKIE);
}

export function queryCurrentUser() {
    if (!getSessionCookie())
        return EMPTY;

    return ajax.getJSON<User | null>(`/api/current-user`);
}

export interface MessagesQueryResult {
    thread: Thread,
    messages: Message[],
}

export interface CommentsQueryResult {
    articleInfo: ArticleInfo,
    comments: Comment[],
    totalComments: number,
}

export function queryMessages(threadId: string, pageNumber: number) {
    return ajax.getJSON<MessagesQueryResult | null>(`/api/messages?threadId=${threadId}&page=${pageNumber}`);
}

export function queryComments(articleId: string, pageNumber: number) {
    return ajaxGet<CommentsQueryResult>(`/api/comments?articleId=${articleId}&page=${pageNumber}`);
}

export function searchMessages(queryString: string): Observable<Result<MessageSearchResults>> {
    return ajaxGet<MessageSearchResults>(`/api/search-messages?${new URLSearchParams({query: queryString})}`);
}

export function searchArticles(queryString: string): Observable<Result<ArticleSearchResults>> {
    return ajaxGet<ArticleSearchResults>(`/api/search-articles?${new URLSearchParams({query: queryString})}`);
}

export function getArticle(id: string): Observable<Result<Article>> {
    return ajaxGet<Article>(`/api/article?id=${id}`);
}

export function getArchivedArticle(id: string, version: string): Observable<Result<Article>> {
    return ajaxGet<Article>(`/api/article?id=${id}&version=${version}`);
}

export function postMessage(threadId: number, message: string) {
    return ajax.post<{}>("/api/message", {threadId, message}).pipe(switchMap(filterErrors));
}

export function postComment(articleId: number, message: string) {
    return ajax.post<{}>("/api/comment", {articleId, message}).pipe(switchMap(filterErrors));
}

export function isNonNulled<T>(value: T): value is NonNullable<T> {
    return value != null;
}

export interface ArticleInfo {
    id: number,
    path: string,
    name: string,
}

export interface Articles {
    articles: ArticleInfo[],
}

export interface ArticleVersion {
    version: number,
    createTime: number,
    user: User,
    active: boolean
}

export interface Article {
    info: ArticleInfo,
    content: string,
    user: User,
    createTime: number,
    version: number,
    active: boolean,
    commentsCount: number,
    visibility: ArticleVisibility,

    versions: ArticleVersion[]
}

export type ArticleVisibility = "public" | "private";

export interface MessageSearchParams {
    query: string,
}

export interface MessageSearchResult {
    id: number,
    threadId: number,
    threadName: string,
    createTime: number,
    user: User,
    content: string,
}

export interface MessageSearchResults {
    messages: MessageSearchResult[],
}

export type SearchResultFragment = {Normal: string} | {Highlight: string};

export interface ArticleSearchResult {
    info: ArticleInfo,
    text: SearchResultFragment[],
}

export interface ArticleSearchResults {
    articles: ArticleSearchResult[],
}

export interface UserSession {
    session: string,
}

export interface UserSessions {
    sessions: UserSession[],
}

export function queryUserSessions() {
    return ajax.getJSON<UserSessions>("/api/current-user-sessions");
}

export function queryArticles() {
    return ajax.getJSON<Articles>("/api/article/list");
}

export function queryFavoriteArticles() {
    return ajax.getJSON<Articles>("/api/article/favorite/list");
}

export interface UploadedFile {
    id: string,
    fileName: string,
    mime: string,
}

export interface UploadedFiles {
    files: UploadedFile[],
}

