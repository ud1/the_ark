import {observer} from "mobx-react";
import {ARTICLE_ARCHIVED_PATH, ARTICLE_COMMENTS_PATH, ARTICLE_PATH, ARTICLES_PATH, currentAddress, ROOT_PATH, SECTION_PATH, SUBSECTION_PATH, THREAD_PATH} from "./router";
import {forumStructureState} from "./forumStructure";
import {Section, SubSection, Thread} from "./requests";
import {currentThreadState} from "./thread";
import {viewArticleState} from "./article";
import {Link} from "./components";
import {articleCommentsState} from "./articleComments";
import * as React from "react";

export const Breadcrumb = observer(() => {
    let addr = currentAddress.address;

    let section : Section | null = null;
    if (addr.template == SECTION_PATH) {
        section = forumStructureState.sections.get(+addr.sectionId);
    }

    let subsection : SubSection | null = null;
    if (addr && addr.template == SUBSECTION_PATH) {
        subsection = forumStructureState.subSections.get(+addr.subSectionId);
        if (subsection)
            section = forumStructureState.sections.get(subsection.sectionId);
    }

    let thread: Thread | null = null;
    if (addr && addr.template == THREAD_PATH) {
        thread = currentThreadState.currentThread;
        if (thread)
            subsection = forumStructureState.subSections.get(thread.subSectionId);

        if (subsection)
            section = forumStructureState.sections.get(subsection.sectionId);
    }

    let article = "result" in viewArticleState.article ? viewArticleState.article.result : null;

    return <p>
        <Link address={{template: ROOT_PATH, params: {}}}>{"Main"}</Link>
        {section && <>
            {" / "}
            <Link address={{template: SECTION_PATH, sectionId: `${section.id}`, params: {}}}>{section.name}</Link>
        </>}
        {subsection && <>
            {" / "}
            <Link address={{template: SUBSECTION_PATH, subSectionId: `${subsection.id}`, params: {}}}>{subsection.name}</Link>
        </>}
        {thread && <>
            {" / "}
            <Link address={{template: THREAD_PATH, threadId: `${thread.id}`, params: {}}}>{thread.name}</Link>
        </>}
        {(addr.template == ARTICLES_PATH || addr.template == ARTICLE_PATH || addr.template == ARTICLE_ARCHIVED_PATH || addr.template == ARTICLE_COMMENTS_PATH) && <>
            {" / "}
            <Link address={{template: ARTICLES_PATH}}>{"Articles"}</Link>
        </>}
        {addr.template == ARTICLE_PATH && <>
            {" / "}
            <Link address={{template: ARTICLE_PATH, articleId: addr.articleId}}>{article?.info.name}</Link>
        </>}
        {addr.template == ARTICLE_ARCHIVED_PATH && <>
            {" / "}
            <Link address={{template: ARTICLE_ARCHIVED_PATH, articleId: addr.articleId, version: addr.version}}>{article?.info.name}</Link>
        </>}
        {addr.template == ARTICLE_COMMENTS_PATH && <>
            {("result" in articleCommentsState.articleComments) && <>
                {" / "}
                <Link address={{template: ARTICLE_PATH, articleId: addr.articleId}}>{articleCommentsState.articleComments.result.articleInfo.name}</Link>
            </>}
            {" / "}
            <Link address={{template: ARTICLE_COMMENTS_PATH, articleId: addr.articleId, articleVersion: addr.articleVersion, params:{}}}>{"Comments"}</Link>
        </>}
    </p>;
});
