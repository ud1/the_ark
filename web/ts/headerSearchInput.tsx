import {action, computed, makeObservable} from "mobx";
import {TextField} from "./components";
import {ARTICLE_ARCHIVED_PATH, ARTICLE_PATH, ARTICLE_SEARCH_PATH, ARTICLES_PATH, currentAddress, MESSAGE_SEARCH_PATH, ROOT_PATH, SECTION_PATH, SUBSECTION_PATH, THREAD_PATH} from "./router";
import * as React from "react";
import {observer} from "mobx-react";

class HeaderSearchState {
    constructor() {
        makeObservable(this);
    }

    searchString = new TextField();

    @computed
    get searchFormType() {
        let template = currentAddress.address.template;
        if (template == ARTICLES_PATH
            || template == ARTICLE_PATH
            || template == ARTICLE_ARCHIVED_PATH
            || template == ARTICLE_SEARCH_PATH) {
            return "article";
        }

        if (template == ROOT_PATH
            || template == SECTION_PATH
            || template == SUBSECTION_PATH
            || template == THREAD_PATH
            || template == MESSAGE_SEARCH_PATH)
        {
            return "forum";
        }

        return null;
    }

    @action.bound
    onSearchStringKeyDown(e: React.KeyboardEvent) {
        if (e.key == 'Enter') {
            if (this.searchString.value) {
                if (this.searchFormType == "forum")
                    currentAddress.goTo({template: MESSAGE_SEARCH_PATH, searchString: this.searchString.value});
                else if (this.searchFormType == "article")
                    currentAddress.goTo({template: ARTICLE_SEARCH_PATH, searchString: this.searchString.value});
            }
        }
    }
}

const headerSearchState = new HeaderSearchState();

export const SearchBar = observer(() => {
    if (!headerSearchState.searchFormType)
        return null;

    return <div className={"pure-form message-search"}>
        <input size={20}
               value={headerSearchState.searchString.value}
               onChange={headerSearchState.searchString.onChange}
               onKeyDown={headerSearchState.onSearchStringKeyDown}
               placeholder={"Search"}
        />
    </div>
});
