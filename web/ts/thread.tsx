import {observer} from "mobx-react";
import {Link, Paging} from "./components";
import * as React from "react";
import {action, makeObservable, observable, reaction} from "mobx";
import {Message, MessagesQueryResult, queryMessages, Thread} from "./requests";
import {combineLatest, EMPTY, filter, startWith, switchMap} from "rxjs";
import {currentAddress, NOT_FOUND_PATH, router, scrollToHashElement, THREAD_PATH} from "./router";
import {forumStructureState} from "./forumStructure";
import {currentUserState} from "./currentUser";
import {MessageContent, NewMessage} from "./message";
import {renameThreadState} from "./threadRename";
import {deleteThreadState} from "./threadDelete";
import {threadEvent$, threadMessageEvent$} from "./events";
import {moveThreadState} from "./threadMove";

class CurrentThreadState {
    constructor() {
        makeObservable(this);

        combineLatest([threadMessageEvent$.pipe(startWith("")),
            threadEvent$.pipe(filter(t => t == "threadMoved"), startWith("")),
            currentAddress.pageAddress$], (e1, e2, a) => a).pipe(
            switchMap(v => {
                if (v.template == THREAD_PATH)
                    return queryMessages(v.threadId, v.params.page || 1);

                return EMPTY;
            })
        ).subscribe(this.updateMessages);

        reaction(() => router.hash, () => {
            this.hashChanged = true;
        });
    }

    @observable currentThread: Thread | null = null;
    @observable pageMessages = new Array<Message>();
    hashChanged = true;

    @action.bound
    updateMessages(messages: MessagesQueryResult | null) {
        if (messages) {
            this.currentThread = messages.thread;
            this.pageMessages = messages.messages;

            if (this.hashChanged) {
                this.hashChanged = false;
                setTimeout(() => {
                    scrollToHashElement();
                }, 1);
            }
        }
        else {
            this.currentThread = null;
            this.pageMessages = [];
            currentAddress.goTo({template: NOT_FOUND_PATH});
        }
    }
}

export const currentThreadState = new CurrentThreadState();

export const ThreadPaging = observer(() => {
    if (currentAddress.address.template != THREAD_PATH)
        return null;

    if (!currentThreadState.currentThread)
        return null;

    let totalPages = Math.floor((currentThreadState.currentThread.totalMessages + forumStructureState.messagesPerPage - 1) / forumStructureState.messagesPerPage);
    return <p>
        {"Pages: "}
        <Paging currentPage={currentAddress.address.params.page || 1}
                totalPages={totalPages}
                includeFirstPage={true}
                hasNextButton={true}
                linkRenderer={(page, isNextButton) => {
                    return <Link address={{template: THREAD_PATH, threadId: `${currentThreadState.currentThread.id}`, params: {page: page}}}>{`${isNextButton ? "Next" : page}`}</Link>
                }}/>
    </p>
});

export const ThreadPage = observer(() => {
    if (!currentThreadState.currentThread)
        return null;

    return <div className={"thread-messages-page"}>
        <div className={"thread-messages"}>
            <div className={"messages-wrapper"}>
                <div className={"title"}>
                    <h1>
                        {currentThreadState.currentThread.name}
                        {" "}
                        {currentUserState.currentUser && currentThreadState.currentThread.author.id == currentUserState.currentUser.id
                            && <span className={"icon icon-pencil"} onClick={() => renameThreadState.showDialog(currentThreadState.currentThread)}/>}
                        {" "}
                        {currentUserState.currentUser && currentThreadState.currentThread.author.id == currentUserState.currentUser.id &&
                            <span className={"icon icon-bin2"} onClick={() => deleteThreadState.showDeleteThreadDialog(currentThreadState.currentThread)}/>}
                        {" "}
                        {currentUserState.currentUser && forumStructureState.editStructure && <span className={"icon icon-tree"} onClick={() => moveThreadState.showDialog(currentThreadState.currentThread)}/>}
                    </h1>
                </div>

                <ThreadPaging/>

                {currentThreadState.pageMessages.map(m => <MessageContent key={m.id} message={m}/>)}
            </div>
        </div>
        {currentUserState.currentUser && <NewMessage/>}
    </div>
});


