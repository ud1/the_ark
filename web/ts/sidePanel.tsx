import {observer} from "mobx-react";
import {Link} from "./components";
import {ARTICLE_PATH, ARTICLES_PATH, ROOT_PATH, SECTION_PATH, SUBSECTION_PATH, THREAD_PATH} from "./router";
import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {find, findIndex, sortBy} from "lodash";
import {ArticleInfo, Articles, filterErrors, queryFavoriteArticles, queryThreads, Result, Thread, ThreadQueryResult, UserSessions} from "./requests";
import {forumStructureState, groupThreadsBySubSections} from "./forumStructure";
import {combineLatest, of, startWith, switchMap} from "rxjs";
import {currentUserState} from "./currentUser";
import {ajax} from "rxjs/ajax";
import {currentUserEvent$, favoriteArticleEvent$, threadEvent$} from "./events";

class SidePanelState {
    constructor() {
        makeObservable(this);

        threadEvent$
            .pipe(
                startWith({}),
                switchMap(() => queryThreads({template: ROOT_PATH, params: {}}))
            )
            .subscribe(this.updateLastThreads);

        combineLatest([currentUserEvent$.pipe(startWith("start")),
            currentUserEvent$.pipe(startWith("start")),
            favoriteArticleEvent$.pipe(startWith("start"))])
            .pipe(
                startWith({}),
                switchMap(() => {
                    if (currentUserState.currentUser)
                        return queryFavoriteArticles();

                    return of({articles: []});
                })
            )
            .subscribe(this.updateFavoriteArticles);
    }

    @observable favoriteArticles: ArticleInfo[] = [];
    lastThreads = observable(new Map<number, Thread>());

    @computed get orderedFavoriteArticles() {
        return sortBy(this.favoriteArticles, a => a.name);
    }

    getThreadsBySectionCount(sectionId: number) {
        let result = 0;
        let threads = this.lastThreadsBySubSections;
        let subsections = forumStructureState.subSectionsBySections.get(sectionId);
        if (subsections) {
            subsections.forEach(s => {
                let subsectionThreads = threads.get(s.id);
                if (subsectionThreads)
                    result += subsectionThreads.length;
            });
        }

        return result;
    }

    @computed
    get lastThreadsBySubSections() {
        return groupThreadsBySubSections(this.lastThreads);
    }

    @action.bound
    updateLastThreads(threads: Result<ThreadQueryResult>) {
        if ("result" in threads) {
            this.lastThreads.clear();
            threads.result.threads.forEach(t => this.lastThreads.set(t.id, t));
        }
    }

    @action.bound
    updateFavoriteArticles(favoriteArticles: Articles) {
        this.favoriteArticles = favoriteArticles.articles;
    }

    isFavorite(article: ArticleInfo) {
        return !!find(this.favoriteArticles, a => article.id == a.id);
    }

    @action.bound
    toggleFavoriteArticle(article: ArticleInfo) {
        if (this.isFavorite(article)) {
            let currentArticleId = article.id;
            let index = findIndex(this.favoriteArticles, a => currentArticleId == a.id);
            this.favoriteArticles.splice(index, 1);

            ajax.post<UserSessions>("/api/article/favorite/remove", {id: currentArticleId}).pipe(switchMap(filterErrors)).subscribe(() => {
                favoriteArticleEvent$.next({type: "favoriteArticleRemoved"});
            });
        }
        else {
            this.favoriteArticles.push(article);

            ajax.post<UserSessions>("/api/article/favorite/add", {id: article.id}).pipe(switchMap(filterErrors)).subscribe(() => {
                favoriteArticleEvent$.next({type: "favoriteArticleAdded"});
            });
        }
    }
}

export const sidePanelState = new SidePanelState();

export const SidePanel = observer((props: {}) => {
    return <ul>
        <li className={"section articles-section"}>
            <Link address={{template: ARTICLES_PATH}}>{"Articles"}</Link>
            {sidePanelState.orderedFavoriteArticles.length > 0 && <ul>
                {sidePanelState.orderedFavoriteArticles.map(a => {
                    return <li key={a.id} className={"favorite-article"}>
                        <Link address={{template: ARTICLE_PATH, articleId: `${a.id}`}}>{a.name}</Link>
                    </li>
                })}
            </ul>}
        </li>
        {forumStructureState.orderedSections.map(v => <SidePanelSection key={v.id} sectionId={v.id}/>)}
    </ul>
})

const SidePanelSection = observer((props: {sectionId: number}) => {
    let section = forumStructureState.sections.get(props.sectionId);
    if (!section)
        return null;

    let threadCount = sidePanelState.getThreadsBySectionCount(section.id);
    if (!threadCount)
        return null;

    let subsections = forumStructureState.subSectionsBySections.get(props.sectionId);

    return <li className={"section thread-section"}>
        <Link address={{template: SECTION_PATH, sectionId: `${section.id}`, params: {}}}>{section.name}</Link>
        {subsections && subsections.length != 0 &&
            <ul>
                {subsections.map(v => <SidePanelSubSection key={v.id} subSectionId={v.id}/>)}
            </ul>
        }
    </li>
});

const SidePanelSubSection = observer((props: {subSectionId: number}) => {
    let subSection = forumStructureState.subSections.get(props.subSectionId);
    if (!subSection)
        return null;

    let threads = sidePanelState.lastThreadsBySubSections.get(props.subSectionId);
    if (!threads || threads.length == 0)
        return null;

    return <li className={"sub-section"}>
        <Link address={{template: SUBSECTION_PATH, subSectionId: `${subSection.id}`, params: {}}}>{subSection.name}</Link>
        <ul>
            {threads.map(v => <SidePanelThread key={v.id} threadId={v.id}/>)}
        </ul>
    </li>
});

const SidePanelThread = observer((props: {threadId: number}) => {
    let thread = sidePanelState.lastThreads.get(props.threadId);
    if (!thread)
        return null;

    return <li className={"thread"}>
        <Link address={{template: THREAD_PATH, threadId: `${thread.id}`, params: {}}}>{thread.name}</Link>
    </li>
});

