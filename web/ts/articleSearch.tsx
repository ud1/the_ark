import {action, makeObservable, observable} from "mobx";
import {ArticleSearchResults, Result, searchArticles} from "./requests";
import {EMPTY, switchMap} from "rxjs";
import {ARTICLE_PATH, ARTICLE_SEARCH_PATH, currentAddress} from "./router";
import {observer} from "mobx-react";
import {Link} from "./components";
import * as React from "react";

class ArticleSearchState {
    constructor() {
        makeObservable(this);

        currentAddress.pageAddress$.pipe(
            switchMap(v => {
                if (v.template == ARTICLE_SEARCH_PATH) {
                    return searchArticles(v.searchString);
                }

                return EMPTY;
            })
        ).subscribe(this.updateArticlesSearchResult);
    }

    @observable articleSearchResults: Result<ArticleSearchResults> = {result: {articles: []}};

    @action.bound
    updateArticlesSearchResult(result: Result<ArticleSearchResults>) {
        this.articleSearchResults = result;
    }
}

export const articleSearchState = new ArticleSearchState();

export const ArticleSearchPage = observer(() => {
    if (currentAddress.address.template != ARTICLE_SEARCH_PATH)
        return null;

    let title = `Article search: ${currentAddress.address.searchString}`;

    return <div className={"message-search-results"}>
        <h1>{title}</h1>

        {"inProgress" in articleSearchState.articleSearchResults && <p>{"Searching..."}</p>}

        {"error" in articleSearchState.articleSearchResults && <p className={"error"}>{articleSearchState.articleSearchResults.error}</p>}

        {"result" in articleSearchState.articleSearchResults && articleSearchState.articleSearchResults.result.articles.map(a => {
            return <div key={`${a.info.id}`} className={"message"}>
                <table className={"message-tab"}>
                    <thead>
                    <tr>
                        <th className={"left col-70"}>
                            <Link address={{template: ARTICLE_PATH, articleId: `${a.info.id}`}}>{a.info.name}</Link>
                        </th>
                        <th className={"left col-30"}>{a.info.path}</th>
                    </tr>
                    </thead>
                </table>
                <div className={"message-block"}>
                    {a.text.map(f => {
                        if ("Normal" in f)
                            return <span>{f.Normal}</span>;

                        return <b>{f.Highlight}</b>
                    })}
                </div>
            </div>
        })}
    </div>
});
