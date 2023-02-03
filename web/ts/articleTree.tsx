import {ArticleInfo} from "./requests";
import {sortBy} from "lodash";
import {observer} from "mobx-react";
import {Link} from "./components";
import {ARTICLE_PATH} from "./router";
import * as React from "react";


export interface ArticlesTreeNode {
    segment: string,
    children: ArticlesTreeNode[];
    articles: ArticleInfo[];
}

export function sortArticleTree(tree: ArticlesTreeNode) {
    tree.children = sortBy(tree.children, v => v.segment);
    tree.articles = sortBy(tree.articles, v => v.name);

    for (let child of tree.children) {
        sortArticleTree(child);
    }
}

export function buildArticleTree(articles: ArticleInfo[]) {
    let result: ArticlesTreeNode = {
        segment: "",
        children: [],
        articles: [],
    };

    for (let article of articles) {
        let segments = article.path.split("/");

        let root = result;
        for (let segment of segments) {
            let found = false;
            for (let child of root.children) {
                if (child.segment == segment) {
                    found = true;
                    root = child;
                    break;
                }
            }

            if (!found) {
                let child: ArticlesTreeNode = {
                    segment,
                    children: [],
                    articles: [],
                }

                root.children.push(child);
                root = child;
            }
        }

        root.articles.push(article);
    }

    sortArticleTree(result);
    return result;
}

export const ArticleTree = observer((props: {node: ArticlesTreeNode}) => {
    if (props.node.articles.length == 0 && props.node.children.length == 0)
        return null;

    return <ul>
        {props.node.articles.map(a => {
            return <li key={`${a.id}`} className={"article-tree-node-article"}>
                <Link address={{template: ARTICLE_PATH, articleId: `${a.id}`}}>{"* "}{a.name}</Link>
            </li>
        })}

        {props.node.children.map(a => {
            return <li key={`${a.segment}`} className={"article-tree-node-segment"}>
                <span className="caret">{"— "}{a.segment}</span>
                <ArticleTree node={a}/>
            </li>
        })}
    </ul>
});
