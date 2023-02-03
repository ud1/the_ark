import {observer} from "mobx-react";
import {SmallDialog} from "./components";
import * as React from "react";
import {action, makeObservable, observable} from "mobx";
import {filterErrors, Thread} from "./requests";
import {ajax} from "rxjs/ajax";
import {switchMap} from "rxjs";
import {sidePanelState} from "./sidePanel";
import {threadEvent$} from "./events";
import {forumStructureState, SubsectionSelect, SubselectionSelectState} from "./forumStructure";

class MoveThreadState {
    constructor() {
        makeObservable(this);
    }

    newSubsection = new SubselectionSelectState();
    @observable isOpen = false;
    @observable thread: Thread | null;

    @action.bound
    showDialog(thread: Thread) {
        this.newSubsection.subsection = forumStructureState.subSections.get(thread.subSectionId);
        this.thread = thread;
        this.isOpen = true;
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    move(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/thread/move", {threadId: this.thread!.id, newSubsectionId: this.newSubsection.subsection.id}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                threadEvent$.next("threadMoved");
            }
        });
    }
}

export const moveThreadState = new MoveThreadState();

export const MoveThreadDialog = observer(() => {
    if (!moveThreadState.isOpen)
        return null;

    return <SmallDialog
        onClose={moveThreadState.hideDialog}
        title={`Move thread ${moveThreadState.thread.name} to another subsection`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-subsection">{"New subsection"}</label>
                    <SubsectionSelect state={moveThreadState.newSubsection} id={"aligned-subsection"}/>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={moveThreadState.move}
                            disabled={!moveThreadState.newSubsection.subsection || moveThreadState.thread.id == moveThreadState.newSubsection.subsection.id}
                    >{"Move"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});
