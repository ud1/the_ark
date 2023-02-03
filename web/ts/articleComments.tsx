import {action, makeObservable, observable, reaction} from "mobx";
import {ARTICLE_COMMENTS_PATH, ARTICLE_PATH, currentAddress, router, scrollToHashElement} from "./router";
import {combineLatest, EMPTY, startWith, switchMap} from "rxjs";
import {CommentsQueryResult, queryComments, Result} from "./requests";
import {observer} from "mobx-react";
import {forumStructureState} from "./forumStructure";
import {Link, Paging} from "./components";
import * as React from "react";
import {MessageContent, NewMessage} from "./message";
import {currentUserState} from "./currentUser";
import {articleCommentEvent$} from "./events";

class ArticleCommentsState {
    constructor() {
        makeObservable(this);

        combineLatest([articleCommentEvent$.pipe(startWith("start")), currentAddress.pageAddress$], (e, a) => a).pipe(
            switchMap(v => {
                if (v.template == ARTICLE_COMMENTS_PATH)
                    return queryComments(v.articleId, v.params.page || 1);

                return EMPTY;
            })
        ).subscribe(this.updateArticleComments);

        reaction(() => router.hash, () => {
            this.hashChanged = true;
        });
    }

    @observable articleComments: Result<CommentsQueryResult> = {inProgress: true};
    hashChanged = true;

    @action.bound
    updateArticleComments(articleComments: Result<CommentsQueryResult>) {
        this.articleComments = articleComments;

        if (this.hashChanged) {
            this.hashChanged = false;
            setTimeout(() => {
                scrollToHashElement();
            }, 1);
        }
    }
}

export const articleCommentsState = new ArticleCommentsState();

export const ArticleCommentsPaging = observer(() => {
    if (currentAddress.address.template != ARTICLE_COMMENTS_PATH)
        return null;

    if (!("result" in articleCommentsState.articleComments))
        return null;

    let articleId = currentAddress.address.articleId;
    let articleVersion = currentAddress.address.articleVersion;

    let comments = articleCommentsState.articleComments.result;
    let totalPages = Math.floor((comments.totalComments + forumStructureState.messagesPerPage - 1) / forumStructureState.messagesPerPage);
    return <p>
        {"Pages: "}
        <Paging currentPage={currentAddress.address.params.page || 1}
                totalPages={totalPages}
                includeFirstPage={true}
                hasNextButton={true}
                linkRenderer={(page, isNextButton) => {
                    return <Link address={{template: ARTICLE_COMMENTS_PATH, articleId: `${articleId}`,
                        articleVersion: articleVersion,
                        params: {page: page}}}>{`${isNextButton ? "Next" : page}`}</Link>
                }}/>
    </p>
});

export const ArticleCommentsPage = observer(() => {
    if (currentAddress.address.template != ARTICLE_COMMENTS_PATH)
        return null;
    if (!("result" in articleCommentsState.articleComments))
        return null;

    return <div className={"thread-messages-page"}>
        <div className={"thread-messages"}>
            <div className={"messages-wrapper"}>
                <div className={"title"}>
                    <h1>
                        {"Comments on the article "}
                        <Link address={{template: ARTICLE_PATH, articleId: currentAddress.address.articleId}}>{articleCommentsState.articleComments.result.articleInfo.name}</Link>
                    </h1>
                </div>

                <ArticleCommentsPaging/>

                {articleCommentsState.articleComments.result.comments.length == 0 &&
                    <p>{"No comments yet"}</p>
                }
                {articleCommentsState.articleComments.result.comments.map(m => <MessageContent key={m.id} message={m}/>)}
            </div>
        </div>
        {currentUserState.currentUser && <NewMessage/>}
    </div>
});

