import {FileUploadable} from "./fileUploadable";
import {action, makeObservable, observable, runInAction} from "mobx";
import * as React from "react";
import {ARTICLE_COMMENTS_PATH, currentAddress, router, THREAD_PATH} from "./router";
import {Comment, filterErrors, Message, postComment, postMessage, Thread} from "./requests";
import {currentThreadState} from "./thread";
import {ajax} from "rxjs/ajax";
import {switchMap} from "rxjs";
import {observer} from "mobx-react";
import {LargeDialog} from "./components";
import MarkdownEditor from "@uiw/react-markdown-editor";
import {EditorView} from "codemirror";
import {Instant, LocalDateTime} from "@js-joda/core";
import {currentUserState} from "./currentUser";
import {DATE_FORMAT, TIME_FORMAT} from "./utils";
import {articleCommentEvent$, threadMessageEvent$} from "./events";
import {articleCommentsState} from "./articleComments";

class NewMessageState implements FileUploadable {
    constructor() {
        makeObservable(this);
    }

    @observable messageText = "";

    @action.bound
    onChangeMessageText(value: string) {
        this.messageText = value;
    }

    @action.bound
    postMessage(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        if (currentAddress.address.template == THREAD_PATH) {
            if (currentThreadState.currentThread) {
                postMessage(currentThreadState.currentThread.id, this.messageText).subscribe(v => {
                    runInAction(() => {
                        this.messageText = "";
                        threadMessageEvent$.next("messageCreated");
                    })
                });
            }
        }
        else if (currentAddress.address.template == ARTICLE_COMMENTS_PATH) {
            postComment(+currentAddress.address.articleId, this.messageText).subscribe(v => {
                runInAction(() => {
                    this.messageText = "";
                    articleCommentEvent$.next("commentCreated");
                })
            });
        }
    }

    @action.bound
    fileUploaded(mdLinks: string) {
        this.messageText += mdLinks;
    }
}

export const newMessageState = new NewMessageState();

class UpdateMessageState implements FileUploadable {
    constructor() {
        makeObservable(this);
    }

    @observable isOpen = false;
    @observable messageText = "";
    @observable threadId: number | null;
    @observable articleId: number | null;
    @observable id: number | null;

    @action.bound
    showDialog(thread: Thread, message: Message | Comment) {
        this.messageText = message.content;
        this.isOpen = true;
        this.id = message.id;

        if ("threadId" in message) {
            this.threadId = message.threadId;
        }
        else {
            this.articleId = message.articleId;
        }
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    onChangeMessageText(value: string) {
        this.messageText = value;
    }

    @action.bound
    update(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        let isThread = !!this.threadId;
        let req = isThread ? ajax.post<string>("/api/message/update", {message: this.messageText, messageId: this.id, threadId: this.threadId}) :
            ajax.post<string>("/api/comment/update", {message: this.messageText, commentId: this.id, articleId: this.articleId});

        req.pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                if (isThread)
                    threadMessageEvent$.next("messageUpdated");
                else
                    articleCommentEvent$.next("commentUpdated");
            }
        });
    }

    @action.bound
    fileUploaded(mdLinks: string) {
        this.messageText += mdLinks;
    }
}

export const updateMessageState = new UpdateMessageState();

export const UpdateMessageDialog = observer(() => {
    if (!updateMessageState.isOpen)
        return null;

    let title: string;
    if (currentAddress.address.template == THREAD_PATH && currentThreadState.currentThread) {
        title = `Update message of the thread ${currentThreadState.currentThread.name}`;
    }
    else if (currentAddress.address.template == ARTICLE_COMMENTS_PATH && "result" in articleCommentsState.articleComments) {
        title = `Update comment on the article ${articleCommentsState.articleComments.result.articleInfo.name}`;
    }
    else {
        return null;
    }

    return <LargeDialog
        onClose={updateMessageState.hideDialog}
        title={title}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <MarkdownEditor value={updateMessageState.messageText}
                                onChange={updateMessageState.onChangeMessageText}
                                extensions={[EditorView.lineWrapping]}
                />
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={updateMessageState.update}
                            disabled={!updateMessageState.messageText}
                    >{"Update"}</button>
                </div>
            </fieldset>
        </form>
    </LargeDialog>
});

export const MessageContent = observer((props: {message: Message | Comment}) => {
    let t = LocalDateTime.ofInstant(Instant.ofEpochMilli(props.message.createTime));

    let selected = router.hash === `m${props.message.id}`;
    return <div className={`message ${selected ? "selected" : ""}`} id={`m${props.message.id}`}>
        <table className={"message-tab"}>
            <thead>
            <tr>
                <th className={"username-col"}>
                    <a>{props.message.user.name}</a>
                    {" "}
                    {currentUserState.currentUser && currentUserState.currentUser.id == props.message.user.id && <span className={"icon icon-pencil"}
                                                                                                                       onClick={() => updateMessageState.showDialog(currentThreadState.currentThread, props.message)}/>}
                </th>
                <th className={"time-col"}>{t.format(DATE_FORMAT)}</th>
                <th className={"time-col"}>{t.format(TIME_FORMAT)}</th>
                <th className={"msg-id-col"}>
                    <a href={`#m${props.message.id}`}>{"#"}{props.message.id}</a>
                </th>
            </tr>
            </thead>
        </table>
        <MessageBlock content={props.message.content}/>
    </div>
});

export const NewMessage = observer(() => {
    return <div className={"new-message"}>
        <div className={"new-message-content"}>
            <MarkdownEditor value={newMessageState.messageText}
                            onChange={newMessageState.onChangeMessageText}
                            maxHeight={"300px"}
                            toolbarsMode={["preview"]}
                            extensions={[EditorView.lineWrapping]}
            />
        </div>
        <button className="pure-button pure-button-primary post-message-button" onClick={newMessageState.postMessage}>{"Post"}</button>
    </div>
})

export const MessageBlock = observer((props: {content: string}) => {
    return <div className={"message-block"}>
        <MarkdownEditor.Markdown source={props.content}/>
    </div>
});
