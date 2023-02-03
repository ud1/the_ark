import {action, makeObservable, observable} from "mobx";
import {filterErrors, Thread} from "./requests";
import * as React from "react";
import {ajax} from "rxjs/ajax";
import {switchMap} from "rxjs";
import {currentAddress, ROOT_PATH} from "./router";
import {sidePanelState} from "./sidePanel";
import {observer} from "mobx-react";
import {SmallDialog} from "./components";
import {threadEvent$} from "./events";

class DeleteThreadState {
    constructor() {
        makeObservable(this);
    }

    @observable isOpen = false;
    @observable threadId = 0;
    @observable threadName = "";
    @observable approveDeletion = false;

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    showDeleteThreadDialog(thread: Thread) {
        this.threadId = thread.id;
        this.threadName = thread.name;
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

        ajax.post<string>("/api/thread/delete", {threadId: this.threadId}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                currentAddress.goTo({template: ROOT_PATH, params: {}});
                threadEvent$.next("threadDeleted");
            }
        });
    }
}

export const deleteThreadState = new DeleteThreadState();

export const DeleteThreadDialog = observer(() => {
    if (!deleteThreadState.isOpen)
        return null;

    return <SmallDialog
        onClose={deleteThreadState.hideDialog}
        title={`Delete thread "${deleteThreadState.threadName}"?`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="delete-confirmation">
                        <input type="checkbox" id="delete-confirmation"
                               checked={deleteThreadState.approveDeletion}
                               onChange={deleteThreadState.onApproveDeletionChange}/>{" Approve deletion"}
                    </label>
                </div>

                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={deleteThreadState.delete}
                            disabled={!deleteThreadState.approveDeletion}
                    >{"Delete"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});
