import {action, makeObservable, observable} from "mobx";
import {EMPTY, switchMap} from "rxjs";
import {MessageSearchResults, Result, searchMessages} from "./requests";
import {currentAddress, MESSAGE_SEARCH_PATH, THREAD_PATH} from "./router";
import {observer} from "mobx-react";
import {forumStructureState} from "./forumStructure";
import {Instant, LocalDateTime} from "@js-joda/core";
import {Link} from "./components";
import {DATE_FORMAT, TIME_FORMAT} from "./utils";
import {MessageBlock} from "./message";
import * as React from "react";

class ForumSearchState {
    constructor() {
        makeObservable(this);

        currentAddress.pageAddress$.pipe(
            switchMap(v => {
                if (v.template == MESSAGE_SEARCH_PATH) {
                    return searchMessages(v.searchString);
                }

                return EMPTY;
            })
        ).subscribe(this.updateMessageSearchResult);
    }

    @observable messageSearchResults: Result<MessageSearchResults> = {result: {messages: []}};

    @action.bound
    updateMessageSearchResult(result: Result<MessageSearchResults>) {
        this.messageSearchResults = result;
    }
}

export const forumSearchState = new ForumSearchState();

export const MessageSearchPage = observer(() => {
    if (currentAddress.address.template != MESSAGE_SEARCH_PATH)
        return null;

    let title = `Forum search: ${currentAddress.address.searchString}`;

    return <div className={"message-search-results"}>
        <h1>{title}</h1>

        {"inProgress" in forumSearchState.messageSearchResults && <p>{"Searching..."}</p>}

        {"error" in forumSearchState.messageSearchResults && <p className={"error"}>{forumSearchState.messageSearchResults.error}</p>}

        {"result" in forumSearchState.messageSearchResults && forumSearchState.messageSearchResults.result.messages.map(m => {
            let page = Math.floor((m.id + forumStructureState.messagesPerPage - 1) / forumStructureState.messagesPerPage);
            let t = LocalDateTime.ofInstant(Instant.ofEpochMilli(m.createTime));

            return <div key={`${m.threadId}-${m.id}`} className={"message"}>
                <table className={"message-tab"}>
                    <thead>
                    <tr>
                        <th className={"left"}>
                            <Link address={{template: THREAD_PATH, threadId: `${m.threadId}`, params: {page: page}, hash: `m${m.id}`}}>{m.threadName}</Link>
                        </th>
                        <th className={"left author"}>{m.user.name}</th>
                        <th className={"time-col"}>{t.format(DATE_FORMAT)}</th>
                        <th className={"time-col"}>{t.format(TIME_FORMAT)}</th>
                    </tr>
                    </thead>
                </table>
                <MessageBlock content={m.content}/>
            </div>
        })}
    </div>
});
