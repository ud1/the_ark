import {FileUploadable} from "./fileUploadable";
import {action, computed, makeObservable, observable} from "mobx";
import {LargeDialog, TextField} from "./components";
import {filterErrors, SubSection} from "./requests";
import * as React from "react";
import {ajax} from "rxjs/ajax";
import {switchMap} from "rxjs";
import {sidePanelState} from "./sidePanel";
import {observer} from "mobx-react";
import MarkdownEditor from "@uiw/react-markdown-editor";
import {EditorView} from "codemirror";
import {threadEvent$} from "./events";
import {SubsectionSelect, SubselectionSelectState} from "./forumStructure";

class NewThreadState implements FileUploadable {
    constructor() {
        makeObservable(this);
    }

    threadName = new TextField();
    @observable isOpen = false;
    @observable messageText = "";
    subsectionSelect = new SubselectionSelectState();

    @action.bound
    showDialog(subsection: SubSection | null) {
        this.threadName.value = "";
        this.messageText = "";
        this.isOpen = true;
        this.subsectionSelect.subsection = subsection;
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
    create(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/thread", {message: this.messageText, threadName: this.threadName.value, subsectionId: this.subsectionSelect.subsection!.id}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                threadEvent$.next("threadCreated");
            }
        });
    }

    @action.bound
    fileUploaded(mdLinks: string) {
        this.messageText += mdLinks;
    }
}

export const newThreadState = new NewThreadState();

export const NewThreadDialog = observer(() => {
    if (!newThreadState.isOpen)
        return null;

    return <LargeDialog
        onClose={newThreadState.hideDialog}
        title={`New thread`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"Thread name"}</label>
                    <input type="text" id="aligned-name" placeholder="Thread name" className={"pure-input-1-2"} value={newThreadState.threadName.value} onChange={newThreadState.threadName.onChange}/>
                </div>
                <div className="pure-control-group">
                    <label htmlFor="aligned-subsection">{"Subsection"}</label>
                    <SubsectionSelect state={newThreadState.subsectionSelect} id={"aligned-subsection"}/>
                </div>
                <MarkdownEditor value={newThreadState.messageText}
                                onChange={newThreadState.onChangeMessageText}
                                extensions={[EditorView.lineWrapping]}
                />
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={newThreadState.create}
                            disabled={!newThreadState.threadName.value || !newThreadState.messageText || !newThreadState.subsectionSelect.subsection}
                    >{"Create"}</button>
                </div>
            </fieldset>
        </form>
    </LargeDialog>
});
