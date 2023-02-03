import {computed, makeObservable, reaction} from "mobx";
import {
    ARTICLE_ARCHIVED_PATH,
    ARTICLE_COMMENTS_PATH,
    ARTICLE_PATH,
    ARTICLES_PATH,
    currentAddress,
    MESSAGE_SEARCH_PATH, NOT_FOUND_PATH,
    SECTION_PATH,
    SIGNUP_PATH,
    SUBSECTION_PATH,
    THREAD_PATH,
    USER_PROFILE_PATH
} from "./router";
import {forumStructureState} from "./forumStructure";
import {currentThreadState} from "./thread";
import {viewArticleState} from "./article";
import {articleCommentsState} from "./articleComments";

class DocumentTitleState {
    constructor() {
        makeObservable(this);

        reaction(() => this.currentPageTitle, t => {
            document.title = t;
        });
    }

    @computed
    get currentPageTitle() {
        if (currentAddress.address.template == SECTION_PATH)  {
            let section = forumStructureState.sections.get(+currentAddress.address.sectionId);
            if (section)
                return section.name;
        }

        if (currentAddress.address.template == SUBSECTION_PATH)  {
            let subsection = forumStructureState.subSections.get(+currentAddress.address.subSectionId);
            if (subsection)
                return subsection.name;
        }

        if (currentAddress.address.template == THREAD_PATH)  {
            if (currentThreadState.currentThread)
                return currentThreadState.currentThread.name;
        }

        if (currentAddress.address.template == MESSAGE_SEARCH_PATH)  {
            return "Search: " + currentAddress.address.searchString;
        }

        if (currentAddress.address.template == USER_PROFILE_PATH)  {
            return "User profile";
        }

        if (currentAddress.address.template == SIGNUP_PATH)  {
            return "Sign up";
        }

        if (currentAddress.address.template == ARTICLES_PATH)  {
            return "Articles";
        }

        if (currentAddress.address.template == ARTICLE_PATH || currentAddress.address.template == ARTICLE_ARCHIVED_PATH) {
            let article = "result" in viewArticleState.article ? viewArticleState.article.result : null;
            if (article)
                return article.info.name;
        }

        if (currentAddress.address.template == ARTICLE_COMMENTS_PATH)  {
            let commentsQueryResult = "result" in articleCommentsState.articleComments ? articleCommentsState.articleComments.result : null;
            if (commentsQueryResult)
                return `Comments on the article ${commentsQueryResult.articleInfo.name}`;
        }

        if (currentAddress.address.template == NOT_FOUND_PATH)  {
            return "Not found";
        }

        return "The Ark";
    }
}

const documentTitleState = new DocumentTitleState();
