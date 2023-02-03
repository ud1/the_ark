import {Subject} from "rxjs";

export const threadEvent$ = new Subject<"threadRenamed" | "threadCreated" | "threadMoved" | "threadDeleted">();
export const threadMessageEvent$ = new Subject<"messageCreated" | "messageUpdated">();
export const articleCommentEvent$ = new Subject<"commentCreated" | "commentUpdated">();
export const currentUserEvent$ = new Subject<"loggedOn" | "loggedOff">();
export const articleEvent$ = new Subject<{type: "articleCreated" | "articleUpdated"}>();
export const favoriteArticleEvent$ = new Subject<{type: "favoriteArticleRemoved" | "favoriteArticleAdded"}>();
export const forumStructureEvent$ = new Subject<"sectionCreated" | "subsectionCreated" | "sectionRenamed" | "subsectionRenamed" | "subsectionMoved">();
