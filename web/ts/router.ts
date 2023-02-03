import {action, computed, makeObservable, observable, reaction} from "mobx";
import {BehaviorSubject, filter} from "rxjs";
import {isNonNulled} from "./requests";

export const ROOT_PATH = "/";
export const SECTION_PATH = "/forum/s/:sectionId";
export const SUBSECTION_PATH = "/forum/ss/:subSectionId";
export const THREAD_PATH = "/forum/t/:threadId";
export const MESSAGE_SEARCH_PATH = "/forum/ms/:searchString";
export const USER_PROFILE_PATH = "/forum/user";
export const SIGNUP_PATH = "/signup";
export const ARTICLES_PATH = "/articles";
export const ARTICLE_PATH = "/article/a/:articleId";
export const ARTICLE_ARCHIVED_PATH = "/article/d/:articleId/:version";
export const ARTICLE_SEARCH_PATH = "/forum/as/:searchString";
export const ARTICLE_COMMENTS_PATH = "/forum/ac/:articleId/:articleVersion";
export const NOT_FOUND_PATH = "/404";

export type PageAddress = {
    template: typeof ROOT_PATH,
    params: {page?: number}
} | {
    template: typeof SECTION_PATH,
    sectionId: string,
    params: {page?: number}
} | {
    template: typeof SUBSECTION_PATH,
    subSectionId: string,
    params: {page?: number}
} | {
    template: typeof THREAD_PATH,
    threadId: string,
    params: {page?: number},
    hash?: string,
} | {
    template: typeof MESSAGE_SEARCH_PATH,
    searchString: string,
} | {
    template: typeof USER_PROFILE_PATH,
} | {
    template: typeof SIGNUP_PATH,
} | {
    template: typeof ARTICLES_PATH,
} | {
    template: typeof ARTICLE_PATH,
    articleId: string,
} | {
    template: typeof ARTICLE_ARCHIVED_PATH,
    articleId: string,
    version: string,
} | {
    template: typeof ARTICLE_SEARCH_PATH,
    searchString: string
} | {
    template: typeof ARTICLE_COMMENTS_PATH,
    articleId: string,
    articleVersion: string,
    params: {page?: number},
} | {
    template: typeof NOT_FOUND_PATH,
}

export function makeUrl (path: string[], queryParams?: Map<string, any>, hash?: string) {
    let url = path.map(encodeURI).join("/");
    if (queryParams && queryParams.size > 0) {
        let params = new URLSearchParams();
        queryParams.forEach((v, k) => {
            params.set(k, `${v}`);
        });

        url += "?" + params;
    }

    if (hash) {
        url += "#" + hash;
    }

    return url;
}

function removeHash(s: string) {
    if (!s)
        return "";

    if (s.startsWith("#"))
        return s.substring(1);

    return s;
}

class Router {
    constructor() {
        makeObservable(this);

        addEventListener('hashchange', (event) => {
            this.parseCurrentUrl();
        });

        addEventListener('popstate', (event) => {
            this.parseCurrentUrl();
        });

        this.parseCurrentUrl();
    }

    @action.bound
    parseCurrentUrl() {
        this.pathSegments = window.location.pathname.split("/").map(decodeURI);
        this.queryParams.clear();
        new URLSearchParams(window.location.search).forEach((v, k) => {
            this.queryParams.set(k, v);
        });

        this.hash = removeHash(window.location.hash);
    }

    @action.bound
    goTo(path: string[], queryParams: Map<string, any>, hash?: string) {
        this.pathSegments = path;
        this.queryParams.replace(queryParams || new Map());
        this.hash = removeHash(hash);

        window.history.pushState("", "", makeUrl(path, queryParams, hash));
    }

    @observable pathSegments: string[] = [];
    @observable queryParams = observable.map<string, string>();
    @observable hash = "";
}

export const router = new Router();

class CurrentAddress {
    constructor() {
        makeObservable(this);

        reaction(() => ({pageAddress: this.address}), v => {
            this._pageAddress$.next(v.pageAddress);
        }, {fireImmediately: true});
    }

    private _pageAddress$ = new BehaviorSubject<PageAddress | null>(null);
    pageAddress$ = this._pageAddress$.pipe(filter(isNonNulled));

    @computed get address() : PageAddress {
        let parsedPath: {[key: string]: string} | null = null;

        if ((parsedPath = tryParsePath(router.pathSegments, ROOT_PATH))) {
            return {
                template: ROOT_PATH,
                params: {page: router.queryParams.get("page") ? +router.queryParams.get("page") : null}
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, SECTION_PATH))) {
            return {
                template: SECTION_PATH,
                sectionId: parsedPath["sectionId"],
                params: {page: router.queryParams.get("page") ? +router.queryParams.get("page") : null}
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, SUBSECTION_PATH))) {
            return {
                template: SUBSECTION_PATH,
                subSectionId: parsedPath["subSectionId"],
                params: {page: router.queryParams.get("page") ? +router.queryParams.get("page") : null}
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, THREAD_PATH))) {
            return {
                template: THREAD_PATH,
                threadId: parsedPath["threadId"],
                params: {page: router.queryParams.get("page") ? +router.queryParams.get("page") : null},
                hash: router.hash,
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, MESSAGE_SEARCH_PATH))) {
            return {
                template: MESSAGE_SEARCH_PATH,
                searchString: parsedPath["searchString"]
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, USER_PROFILE_PATH))) {
            return {
                template: USER_PROFILE_PATH
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, SIGNUP_PATH))) {
            return {
                template: SIGNUP_PATH
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, ARTICLES_PATH))) {
            return {
                template: ARTICLES_PATH
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, ARTICLE_PATH))) {
            return {
                template: ARTICLE_PATH,
                articleId: parsedPath["articleId"]
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, ARTICLE_ARCHIVED_PATH))) {
            return {
                template: ARTICLE_ARCHIVED_PATH,
                articleId: parsedPath["articleId"],
                version: parsedPath["version"],
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, ARTICLE_SEARCH_PATH))) {
            return {
                template: ARTICLE_SEARCH_PATH,
                searchString: parsedPath["searchString"]
            }
        }

        if ((parsedPath = tryParsePath(router.pathSegments, ARTICLE_COMMENTS_PATH))) {
            return {
                template: ARTICLE_COMMENTS_PATH,
                articleId: parsedPath["articleId"],
                articleVersion: parsedPath["articleVersion"],
                params: {page: router.queryParams.get("page") ? +router.queryParams.get("page") : null},
            }
        }

        return {
            template: NOT_FOUND_PATH
        }
    }

    goTo(address: PageAddress) {
        let params: {[k: string] : string} = {};
        for (let k in address) {
            let v = address[k];
            if (typeof v == "string")
                params[k] = v;
        }

        const queryParams = address["params"] ? new Map(Object.entries(address["params"])) : null;

        router.goTo(makePath(address.template.split("/"), params), queryParams, address["hash"]);
    }
}

export const currentAddress = new CurrentAddress();

export function makePath(pathSegments: string[], params: {[k: string] : string}) {
    let result = new Array<string>();

    for (let k of pathSegments) {
        if (k.startsWith(":"))
            result.push(params[k.substring(1)]);
        else
            result.push(k);
    }

    return result;
}

export const scrollToHashElement = () => {
    const { hash } = window.location;
    const id = hash?.replace("#", "");
    const elementToScroll = document.getElementById(id);

    if (!elementToScroll)
        return;

    elementToScroll.scrollIntoView({behavior: "smooth"});
};

function tryParsePath(location: string[], pathTemplate: string) {
    let pathSegments = pathTemplate.split("/");

    if (location.length != pathSegments.length)
        return null;

    for (let i = 0; i < location.length; ++i) {
        if (pathSegments[i].startsWith(":"))
            continue;

        if (pathSegments[i] != location[i])
            return null;
    }

    let pathParams: {[key: string]: string} = {};

    for (let i = 0; i < location.length; ++i) {
        if (pathSegments[i].startsWith(":"))
        {
            pathParams[pathSegments[i].substring(1)] = location[i];
        }
    }

    return pathParams;
}
