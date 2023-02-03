import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {observer} from "mobx-react";
import Split from "react-split";
import {Instant, LocalDateTime} from "@js-joda/core";

import 'winbox/dist/css/winbox.min.css';
import "./css/pure-min.css";
import "./css/style.scss";

import "./ts/documentTitle";
import "./ts/fileUploadable";

import {
    ARTICLE_ARCHIVED_PATH,
    ARTICLE_COMMENTS_PATH,
    ARTICLE_PATH,
    ARTICLE_SEARCH_PATH,
    ARTICLES_PATH,
    currentAddress,
    MESSAGE_SEARCH_PATH,
    ROOT_PATH,
    SECTION_PATH,
    SIGNUP_PATH,
    SUBSECTION_PATH,
    THREAD_PATH,
    USER_PROFILE_PATH
} from "./ts/router";
import {
    Articles,
    Section,
    SubSection,
    Thread,
} from "./ts/requests";
import {Link, Paging} from "./ts/components";
import {SidePanel, sidePanelState} from "./ts/sidePanel";
import {
    forumStructureState, MoveSubsectionDialog, moveSubsectionState,
    NewSectionDialog, newSectionState,
    NewSubsectionDialog,
    newSubsectionState,
    RenameSectionDialog, renameSectionState,
    RenameSubsectionDialog,
    renameSubsectionState
} from "./ts/forumStructure";
import {currentUserState, loginState, SignonForm, SignupForm} from "./ts/currentUser";
import {UserForm} from "./ts/userSessions";
import {ArticleDialog, ArticlePage, ArticlesPage, DeleteArticleDialog} from "./ts/article";
import {DATE_TIME_FORMAT} from "./ts/utils";
import {ThreadPage} from "./ts/thread";
import {UpdateMessageDialog} from "./ts/message";
import {NewThreadDialog, newThreadState} from "./ts/threadCreate";
import {RenameThreadDialog} from "./ts/threadRename";
import {DeleteThreadDialog} from "./ts/threadDelete";
import {ArticleCommentsPage} from "./ts/articleComments";
import {ArticleSearchPage} from "./ts/articleSearch";
import {MessageSearchPage} from "./ts/forumSearch";
import {threadListState} from "./ts/threadList";
import {SearchBar} from "./ts/headerSearchInput";
import {Breadcrumb} from "./ts/breadcrumb";
import {MoveThreadDialog} from "./ts/threadMove";

const SubsectionTableThreadPaging = observer((props: {thread: Thread}) => {
    let totalPages = Math.floor((props.thread.totalMessages + forumStructureState.messagesPerPage - 1) / forumStructureState.messagesPerPage);

    if (totalPages <= 1)
        return null;

    return <span>
        {"["}
        <Paging currentPage={1}
                totalPages={totalPages}
                includeFirstPage={false}
                hasNextButton={false}
                linkRenderer={(page, isNextButton) => {
                    <Link key={"p" + page} address={{template: THREAD_PATH, threadId: `${props.thread.id}`, params: {page: page}}}>{`${page}`}</Link>
                }}/>
        {"]"}
    </span>
});

const MainPaging = observer(() => {
    let pageAddress = currentAddress.address;

    if (pageAddress.template != ROOT_PATH && pageAddress.template != SECTION_PATH && pageAddress.template != SUBSECTION_PATH)
        return null;

    let totalThreads = threadListState.totalCurrentPageThreads;
    if (totalThreads == 0)
        totalThreads = 1;
    let totalPages = Math.floor((totalThreads + forumStructureState.threadsPerPage - 1) / forumStructureState.threadsPerPage);

    let subsection: SubSection = null;
    if (pageAddress.template == SUBSECTION_PATH)
        subsection = forumStructureState.subSections.get(+pageAddress.subSectionId);

    return <p>
        {"Pages: "}
        <Paging currentPage={pageAddress.params.page || 1}
                totalPages={totalPages}
                includeFirstPage={true}
                hasNextButton={true}
                linkRenderer={(page, isNextButton) => {
                    if (pageAddress.template == ROOT_PATH)
                        return <Link address={{template: ROOT_PATH, params: {page: page}}}>{`${isNextButton ? "Next" : page}`}</Link>
                    else if (pageAddress.template == SECTION_PATH)
                        return <Link address={{template: SECTION_PATH, sectionId: pageAddress.sectionId, params: {page: page}}}>{`${isNextButton ? "Next" : page}`}</Link>
                    else if (pageAddress.template == SUBSECTION_PATH)
                        return <Link address={{template: SUBSECTION_PATH, subSectionId: pageAddress.subSectionId, params: {page: page}}}>{`${isNextButton ? "Next" : page}`}</Link>
                    else
                        return null;
                }}/>
        {currentUserState.currentUser && !forumStructureState.editStructure &&
            <a href={"##"} className={"new-thread push-right"} onClick={() => newThreadState.showDialog(subsection)}>{"New thread"}</a>
        }
    </p>
});

const SubsectionPage = observer((props: {subSectionId: number}) => {
    let subSection = forumStructureState.subSections.get(props.subSectionId);
    if (!subSection)
        return null;

    return <div>
        <SubsectionTable subSection={subSection}/>
    </div>;
});

const SubsectionTable = observer((props: {subSection: SubSection}) => {
    let threads = threadListState.currentPageThreadsBySubSections.get(props.subSection.id) || [];

    if (!forumStructureState.editStructure && !threads.length) {
        return null;
    }

    if (!threads.length) {
        return <table className={"forum-table sub-section-tab"}>
            <thead>
                <tr>
                    <th>
                        <Link address={{template: SUBSECTION_PATH, subSectionId: `${props.subSection.id}`, params: {}}}>{props.subSection.name}</Link>
                        {" "}
                        {currentUserState.currentUser && forumStructureState.editStructure && <span className={"icon icon-pencil"} onClick={() => renameSubsectionState.showDialog(props.subSection)}/>}
                        {" "}
                        {currentUserState.currentUser && forumStructureState.editStructure && <span className={"icon icon-tree"} onClick={() => moveSubsectionState.showDialog(props.subSection)}/>}
                    </th>
                </tr>
            </thead>
            <tbody>
                {currentUserState.currentUser && forumStructureState.editStructure && <tr>
                    <td className={"center"}>
                        <a href={"##"} className={"new-thread"} onClick={() => newThreadState.showDialog(props.subSection)}>{"New thread"}</a>
                    </td>
                </tr>}
            </tbody>
        </table>
    }

    return <table className={"forum-table sub-section-tab"}>
        <thead>
            <tr>
                <th>
                    <Link address={{template: SUBSECTION_PATH, subSectionId: `${props.subSection.id}`, params: {}}}>{props.subSection.name}</Link>
                    {" "}
                    {currentUserState.currentUser && forumStructureState.editStructure && <span className={"icon icon-pencil"} onClick={() => renameSubsectionState.showDialog(props.subSection)}/>}
                    {" "}
                    {currentUserState.currentUser && forumStructureState.editStructure && <span className={"icon icon-tree"} onClick={() => moveSubsectionState.showDialog(props.subSection)}/>}
                </th>
                <th className={"author"}>{"Author"}</th>
                <th className={"last-user"}>{"Last user"}</th>
                <th className={"right message-count"}>{"#"}</th>
                <th className={"right last-message-time"}>{"Last message"}</th>
            </tr>
        </thead>
        <tbody>
            {threads.map((t) => {
                let lastMessageDateTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(t.lastMessageDateTime));

                return <tr key={t.id}>
                    <td>
                        <Link address={{template: THREAD_PATH, threadId: `${t.id}`, params: {}}}>{t.name}</Link>
                        {" "}
                        <SubsectionTableThreadPaging thread={t}/>
                    </td>
                    <td>{t.author.name}</td>
                    <td>{t.lastMessageUser.name}</td>
                    <td className={"right"}>{t.totalMessages}</td>
                    <td className={"right"}>{DATE_TIME_FORMAT.format(lastMessageDateTime)}</td>
                </tr>
            })}

            {currentUserState.currentUser && forumStructureState.editStructure && <tr>
                <td colSpan={5} className={"center"}>
                    <a href={"##"} className={"new-thread"} onClick={() => newThreadState.showDialog(props.subSection)}>{"New thread"}</a>
                </td>
            </tr>}
        </tbody>
    </table>
});

const Section = observer((props: {sectionId: number}) => {
    let section = forumStructureState.sections.get(props.sectionId);
    if (!section)
        return null;

    if (!forumStructureState.editStructure) {
        let threadCount = threadListState.getThreadsBySectionCount(section.id);
        if (!threadCount)
            return null;
    }

    let subSections = forumStructureState.subSectionsBySections.get(props.sectionId) || [];

    return <div className={"section"}>
        <div className={"title"}>
            <h2>
                <Link address={{template: SECTION_PATH, sectionId: `${section.id}`, params: {}}}>{section.name}</Link>
                {" "}
                {currentUserState.currentUser && forumStructureState.editStructure && <span className={"icon icon-pencil"} onClick={() => renameSectionState.showDialog(section)}/>}
                {currentUserState.currentUser && forumStructureState.editStructure && <div className={"new-subsection"}>
                    <a href={"##"} onClick={() => newSubsectionState.showDialog(section)}>{"New subsection"}</a>
                </div>}
            </h2>
        </div>
        <div className={"section-content"}>
            {subSections.map(v => <SubsectionTable key={v.id} subSection={v}/>)}
        </div>
    </div>
});

const MainPage = observer(() => {
    return <div>
        <MainPaging/>

        <div className={"title"}>
            <h2>
                <Link address={{template: ARTICLES_PATH}}>{"Articles"}</Link>
            </h2>
        </div>

        {forumStructureState.orderedSections.map(s => <Section key={s.id} sectionId={s.id}/>)}
        {currentUserState.currentUser && forumStructureState.editStructure && <div className={"new-section"}>
            <a href={"##"} onClick={newSectionState.showDialog}>{"New section"}</a>
        </div>}
    </div>
});

const Header = observer(() => {
    return <header>
        <div className={"header-left-block"}>
            <Breadcrumb/>
        </div>
        <button className={`edit-forum-structure-toggle ${forumStructureState.editStructure ? "on" : "off"}`} onClick={forumStructureState.toggleEditStructure}>
            <span className={"icon icon-cogs"}/>
        </button>
        <SearchBar/>
        {!currentUserState.currentUser &&
            <button className={"pure-button button-small login-btn"} onClick={loginState.toggleLoginDialogVisible}>{"Login"}</button>
        }
        {currentUserState.currentUser &&
            <div>
                <Link address={{template: USER_PROFILE_PATH}}>{currentUserState.currentUser.name}</Link>
            </div>
        }
    </header>;
});

const Root = observer((props: React.PropsWithChildren<{contentClassName?: string}>) => {
    return <div className={"body-container"}>
        <Header/>
        <Split
            direction={"horizontal"}
            sizes={[10, 90]}
            className={"split-h"}
            minSize={[1, 500]}
        >
            <div className={"side-panel"}>
                <SidePanel/>
            </div>

            <div className={`content-panel ${props.contentClassName || ""}`}>
                {props.children}
            </div>
        </Split>
    </div>
});

function NotFound() {
    return (
        <div id="error-page">
            <p>
                404 - Not found
            </p>
        </div>
    );
}

const Dialogs = observer(() => {
    return <div>
        <NewSectionDialog/>
        <NewSubsectionDialog/>
        <NewThreadDialog/>
        <RenameSectionDialog/>
        <RenameSubsectionDialog/>
        <MoveSubsectionDialog/>
        <SignonForm/>
    </div>
});

const ThreadDialogs = observer(() => {
    return <div>
        <UpdateMessageDialog/>
        <RenameThreadDialog/>
        <DeleteThreadDialog/>
        <MoveThreadDialog/>
        <SignonForm/>
    </div>
});

const ArticleDialogs = observer(() => {
    return <div>
        <ArticleDialog/>
        <DeleteArticleDialog/>
        <SignonForm/>
    </div>
});

const App = observer(() => {
    let address = currentAddress.address;

    switch (address.template) {
        case ROOT_PATH:
            return <Root>
                <MainPage/>
                <Dialogs/>
            </Root>;

        case SECTION_PATH:
            return <Root>
                <MainPaging/>
                <Section sectionId={+address.sectionId}/>
                <Dialogs/>
            </Root>;

        case SUBSECTION_PATH:
            return <Root>
                <MainPaging/>
                <SubsectionPage subSectionId={+address.subSectionId}/>
                <Dialogs/>
            </Root>;

        case THREAD_PATH:
            return <Root contentClassName={"threads-content"}>
                <ThreadPage/>
                <ThreadDialogs/>
            </Root>;

        case MESSAGE_SEARCH_PATH:
            return <Root>
                <MessageSearchPage/>
            </Root>;

        case ARTICLE_SEARCH_PATH:
            return <Root>
                <ArticleSearchPage/>
            </Root>;

        case ARTICLES_PATH:
            return <Root>
                <ArticlesPage/>
                <ArticleDialogs/>
            </Root>;

        case ARTICLE_PATH:
        case ARTICLE_ARCHIVED_PATH:
            return <Root contentClassName={"threads-content"}>
                <ArticlePage/>
                <ArticleDialogs/>
            </Root>;

        case ARTICLE_COMMENTS_PATH:
            return <Root contentClassName={"threads-content"}>
                <ArticleCommentsPage/>
                <ThreadDialogs/>
            </Root>;

        case USER_PROFILE_PATH:
            return <div className={"body-container user-form"}>
                <Header/>
                <UserForm/>
                <SignonForm/>
            </div>

        case SIGNUP_PATH:
            return <div className={"body-container"}>
                <Header/>
                <SignupForm/>
                <SignonForm/>
            </div>
    }

    return <NotFound/>;
});

const root = createRoot(document.getElementById('react-container')!);
root.render(<React.StrictMode>
    <App/>
</React.StrictMode>);
