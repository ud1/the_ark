import {observer} from "mobx-react";
import {SmallDialog, TextField} from "./components";
import * as React from "react";
import {action, makeObservable, observable} from "mobx";
import {filterErrors, Thread} from "./requests";
import {ajax} from "rxjs/ajax";
import {switchMap} from "rxjs";
import {sidePanelState} from "./sidePanel";
import {threadEvent$} from "./events";

class RenameThreadState {
    constructor() {
        makeObservable(this);
    }

    newThreadName = new TextField();
    @observable isOpen = false;
    @observable thread: Thread | null;

    @action.bound
    showDialog(thread: Thread) {
        this.newThreadName.value = thread.name;
        this.thread = thread;
        this.isOpen = true;
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    rename(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/thread/rename", {name: this.newThreadName.value, threadId: this.thread!.id}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                threadEvent$.next("threadRenamed");
            }
        });
    }
}

export const renameThreadState = new RenameThreadState();

export const RenameThreadDialog = observer(() => {
    if (!renameThreadState.isOpen)
        return null;

    return <SmallDialog
        onClose={renameThreadState.hideDialog}
        title={`Rename thread ${renameThreadState.thread.name}`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"New thread name"}</label>
                    <input type="text" id="aligned-name" placeholder="Section name" value={renameThreadState.newThreadName.value} onChange={renameThreadState.newThreadName.onChange}/>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={renameThreadState.rename}
                            disabled={!renameThreadState.newThreadName.value}
                    >{"Rename"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});
