import {action, computed, makeObservable, observable} from "mobx";
import {LargeDialog, Link, SmallDialog, TextField} from "./components";
import {Article, ArticleInfo, Articles, ArticleVisibility, filterErrors, getArchivedArticle, getArticle, queryArticles, Result} from "./requests";
import * as React from "react";
import {ajax} from "rxjs/ajax";
import {combineLatest, EMPTY, startWith, switchMap} from "rxjs";
import {ARTICLE_ARCHIVED_PATH, ARTICLE_COMMENTS_PATH, ARTICLE_PATH, ARTICLES_PATH, currentAddress} from "./router";
import {FileUploadable} from "./fileUploadable";
import {observer} from "mobx-react";
import {currentUserState} from "./currentUser";
import {sidePanelState} from "./sidePanel";
import {Instant, LocalDateTime} from "@js-joda/core";
import MarkdownEditor from "@uiw/react-markdown-editor";
import {EditorView} from "codemirror";
import {ArticleTree, buildArticleTree} from "./articleTree";
import {find} from "lodash";
import {DATE_TIME_FORMAT} from "./utils";
import {articleEvent$, currentUserEvent$} from "./events";

class ArticlesPageState {
    constructor() {
        makeObservable(this);

        combineLatest([articleEvent$.pipe(startWith("start")), currentUserEvent$.pipe(startWith("start")), currentAddress.pageAddress$], (e1, e2, a) => a).pipe(
            switchMap(v => {
                if (v.template == ARTICLES_PATH)
                    return queryArticles();

                return EMPTY;
            })
        ).subscribe(this.updateArticles);
    }

    articleFilter = new TextField();
    @observable articles: ArticleInfo[] = [];

    @action.bound
    updateArticles(articles: Articles) {
        this.articles = articles.articles;
    }

    @computed get articleTree() {
        let articles = this.articles;
        if (this.articleFilter.value) {
            let filter = this.articleFilter.value.toLowerCase();
            articles = articles.filter(a => {
                return a.path.toLowerCase().indexOf(filter) >= 0 || a.name.toLowerCase().indexOf(filter) >= 0;
            });
        }

        return buildArticleTree(articles);
    }
}

export const articlesPageState = new ArticlesPageState();

class ViewArticleState {
    constructor() {
        makeObservable(this);

        combineLatest([articleEvent$.pipe(startWith("start")), currentAddress.pageAddress$], (e, a) => a).pipe(
            switchMap(v => {
                if (v.template == ARTICLE_PATH)
                    return getArticle(v.articleId);

                return EMPTY;
            })
        ).subscribe(this.updateArticle);

        currentAddress.pageAddress$.pipe(
            switchMap(v => {
                if (v.template == ARTICLE_ARCHIVED_PATH)
                    return getArchivedArticle(v.articleId, v.version);

                return EMPTY;
            })
        ).subscribe(this.updateArticle);
    }

    @observable article: Result<Article> = {inProgress: true};

    @action.bound
    updateArticle(result: Result<Article>) {
        this.article = result;
    }

    @computed
    get currentArticleIsFavorite() {
        if ("result" in this.article) {
            return sidePanelState.isFavorite(this.article.result.info);
        }

        return false;
    }

    @action.bound
    onArticleVersionChange(event: React.ChangeEvent<HTMLSelectElement>) {
        if (!("result" in this.article))
            return;

        let version = +event.target.value;

        let a = find(this.article.result.versions, v => v.version == version);
        if (a.active) {
            currentAddress.goTo({template: ARTICLE_PATH, articleId: `${this.article.result.info.id}`});
        }
        else {
            currentAddress.goTo({template: ARTICLE_ARCHIVED_PATH, articleId: `${this.article.result.info.id}`, version: `${version}`});
        }
    }
}

export const viewArticleState = new ViewArticleState();

class CreateUpdateArticleState implements FileUploadable {
    constructor() {
        makeObservable(this);
    }

    path = new TextField();
    articleName = new TextField();
    @observable isOpen = false;
    @observable contentText = "";
    @observable action: "new" | "update" = "new";
    @observable visibility: ArticleVisibility = "public";
    @observable articleId = 0;

    @action.bound
    showNewArticleDialog() {
        this.path.value = "";
        this.articleName.value = "";
        this.contentText = "";
        this.action = "new";
        this.isOpen = true;
    }

    @action.bound
    showUpdateArticleDialog(article: Article) {
        this.path.value = article.info.path;
        this.articleName.value = article.info.name;
        this.contentText = article.content;
        this.action = "update";
        this.articleId = article.info.id;
        this.visibility = article.visibility;
        this.isOpen = true;
    }

    @action.bound
    onVisibilityChange(event: React.ChangeEvent<HTMLSelectElement>) {
        this.visibility = event.target.value as ArticleVisibility;
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    onChangeContentText(value: string) {
        this.contentText = value;
    }

    @action.bound
    create(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/article", {path: this.path.value, name: this.articleName.value, content: this.contentText, visibility: this.visibility}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                articleEvent$.next({type: "articleCreated"});
            }
        });
    }

    @action.bound
    update(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/article/update", {id: this.articleId, path: this.path.value, name: this.articleName.value, content: this.contentText, visibility: this.visibility}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                articleEvent$.next({type: "articleUpdated"});
            }
        });
    }

    @action.bound
    fileUploaded(mdLinks: string) {
        this.contentText += mdLinks;
    }
}

export const createUpdateArticleState = new CreateUpdateArticleState();

class DeleteArticleState {
    constructor() {
        makeObservable(this);
    }

    @observable isOpen = false;
    @observable articleId = 0;
    @observable articleName = "";
    @observable approveDeletion = false;

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    showDeleteArticleDialog(article: Article) {
        this.articleId = article.info.id;
        this.articleName = article.info.name;
        this.isOpen = true;
        this.approveDeletion = false;
    }

    @action.bound
    onApproveDeletionChange() {
        this.approveDeletion = !this.approveDeletion;
    }

    @action.bound
    delete(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/article/delete", {id: this.articleId}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                currentAddress.goTo({template: ARTICLES_PATH});
            }
        });
    }
}

export const deleteArticleState = new DeleteArticleState();

export const ArticlePage = observer(() => {
    if (currentAddress.address.template != ARTICLE_PATH && currentAddress.address.template != ARTICLE_ARCHIVED_PATH)
        return null;

    let article = "result" in viewArticleState.article ? viewArticleState.article.result : null;

    let isFavorite = viewArticleState.currentArticleIsFavorite;

    return <div className={"articles-page"}>
        <div className={"article"}>
            <div className={"article-wrapper"}>
                {"inProgress" in viewArticleState.article && <p>{"Loading..."}</p>}
                {"error" in viewArticleState.article && <p className={"error"}>{viewArticleState.article.error}</p>}
                {"result" in viewArticleState.article && <>
                    <div className={"title"}>
                        <h1>
                            {viewArticleState.article.result.info.name}
                            {" "}
                            {currentUserState.currentUser && article &&
                                <span className={"icon icon-pencil"} onClick={() => createUpdateArticleState.showUpdateArticleDialog(article)}/>}
                            {" "}
                            {currentUserState.currentUser && article && article.active &&
                                <span className={"icon icon-bin2"} onClick={() => deleteArticleState.showDeleteArticleDialog(article)}/>}
                            {" "}
                            {currentUserState.currentUser && article && article.active &&
                                <span className={`icon favorite ${isFavorite ? "icon-star-full" : "icon-star-empty"}`} onClick={() => sidePanelState.toggleFavoriteArticle(article.info)}/>}
                        </h1>
                    </div>

                    <form className="pure-form">
                        <fieldset>
                            <span className={"push-right"}>
                                <select value={viewArticleState.article.result.version} onChange={viewArticleState.onArticleVersionChange}>
                                    {viewArticleState.article.result.versions.map(v => {
                                        let dateTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(v.createTime));
                                        return <option key={v.version} value={v.version}>{`v${v.version}, ${v.user.name}, ${DATE_TIME_FORMAT.format(dateTime)}`}</option>;
                                    })}
                                </select>
                            </span>
                        </fieldset>
                    </form>

                    <div className={"article-body-wrapper"}>
                        <div className={"article-body"}>

                            <MarkdownEditor.Markdown source={viewArticleState.article.result.content}/>
                        </div>
                    </div>

                    <div className={"article-comments-link"}>
                        <Link address={{template: ARTICLE_COMMENTS_PATH, articleVersion: `${article.version}`, articleId: `${viewArticleState.article.result.info.id}`, params:{}}}
                        >{`Comments [${viewArticleState.article.result.commentsCount}]`}</Link>
                    </div>
                </>}
            </div>
        </div>
    </div>
});

export const DeleteArticleDialog = observer(() => {
    if (!deleteArticleState.isOpen)
        return null;

    return <SmallDialog
        onClose={deleteArticleState.hideDialog}
        title={`Delete article "${deleteArticleState.articleName}"?`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="delete-confirmation">
                        <input type="checkbox" id="delete-confirmation"
                               checked={deleteArticleState.approveDeletion}
                               onChange={deleteArticleState.onApproveDeletionChange}/>{" Approve deletion"}
                    </label>
                </div>

                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={deleteArticleState.delete}
                            disabled={!deleteArticleState.approveDeletion}
                    >{"Delete"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});

export const ArticleDialog = observer(() => {
    if (!createUpdateArticleState.isOpen)
        return null;

    let title = createUpdateArticleState.action == "new" ? "New article" : "Update article";
    let valid = createUpdateArticleState.contentText && createUpdateArticleState.path.value && createUpdateArticleState.articleName.value && true;

    return <LargeDialog
        onClose={createUpdateArticleState.hideDialog}
        title={title}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-path">{"Path"}</label>
                    <input type="text" id="aligned-path" className={"pure-input-1-2"} placeholder="Path" value={createUpdateArticleState.path.value} onChange={createUpdateArticleState.path.onChange}/>
                </div>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"Article name"}</label>
                    <input type="text" id="aligned-name" className={"pure-input-1-2"} placeholder="Article name" value={createUpdateArticleState.articleName.value} onChange={createUpdateArticleState.articleName.onChange}/>
                </div>

                <div className="pure-control-group">
                    <label htmlFor="aligned-visibility">{"Visibility"}</label>
                    <select id="aligned-visibility" className={"pure-input-1-2"} value={createUpdateArticleState.visibility} onChange={createUpdateArticleState.onVisibilityChange}>
                        <option value={"public"}>{"Public"}</option>
                        <option value={"private"}>{"Private"}</option>
                    </select>
                </div>

                <MarkdownEditor value={createUpdateArticleState.contentText}
                                onChange={createUpdateArticleState.onChangeContentText}
                                minHeight={"300px"}
                                extensions={[EditorView.lineWrapping]}
                />

                <div className="pure-controls">
                    {createUpdateArticleState.action == "new" &&
                        <button type="submit" className="pure-button pure-button-primary"
                                onClick={createUpdateArticleState.create}
                                disabled={!valid}
                        >{"Create"}</button>
                    }
                    {createUpdateArticleState.action == "update" &&
                        <button type="submit" className="pure-button pure-button-primary"
                                onClick={createUpdateArticleState.update}
                                disabled={!valid}
                        >{"Update"}</button>
                    }
                </div>
            </fieldset>
        </form>
    </LargeDialog>;
});

export const ArticlesPage = observer(() => {
    if (currentAddress.address.template != ARTICLES_PATH)
        return null;

    return <div className={"article-list"}>
        <h1>{"Articles"}</h1>

        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <input type="text" size={50} placeholder="Filter articles" value={articlesPageState.articleFilter.value} onChange={articlesPageState.articleFilter.onChange}/>
                </div>
            </fieldset>
        </form>

        <ArticleTree node={articlesPageState.articleTree}/>

        <br/>
        {currentUserState.currentUser && <div className={"new-article"}>
            <a href={"##"} onClick={createUpdateArticleState.showNewArticleDialog}>{"New article"}</a>
        </div>}
    </div>
});
