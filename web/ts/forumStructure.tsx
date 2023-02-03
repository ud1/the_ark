import {filterErrors, ForumStructure, queryForumStructure, Section, SubSection, Thread} from "./requests";
import {action, computed, makeObservable, observable} from "mobx";
import {startWith, switchMap} from "rxjs";
import {ajax} from "rxjs/ajax";
import {SmallDialog, TextField} from "./components";
import * as React from "react";
import {observer} from "mobx-react";
import {forumStructureEvent$} from "./events";

class ForumStructureState {
    constructor() {
        makeObservable(this);

        forumStructureEvent$
            .pipe(
                startWith({}),
                switchMap(() => queryForumStructure())
            )
            .subscribe(this.updateForumStructure);
    }

    sections = observable(new Map<number, Section>());
    subSections = observable(new Map<number, SubSection>());
    @observable threadsPerPage: number = 50;
    @observable messagesPerPage: number = 50;
    @observable editStructure = false;

    @computed
    get orderedSections() {
        let result = new Array<Section>();
        this.sections.forEach(v => result.push(v));
        result.sort((a, b) => a.name.localeCompare(b.name));
        return result;
    }

    @computed
    get subSectionsBySections() {
        let result = new Map<number, SubSection[]>;

        this.subSections.forEach(v => {
            let subsectionArray = result.get(v.sectionId) || [];
            subsectionArray.push(v);
            result.set(v.sectionId, subsectionArray);
        });

        result.forEach(l => {
            l.sort((a, b) => a.name.localeCompare(b.name));
        });

        return result;
    }

    @action.bound
    updateForumStructure(s: ForumStructure) {
        this.sections.clear();
        s.sections.forEach(v => this.sections.set(v.id, v));

        this.subSections.clear();
        s.subSections.forEach(v => this.subSections.set(v.id, v));

        this.threadsPerPage = s.threadsPerPage;
        this.messagesPerPage = s.messagesPerPage;
    }

    @action.bound
    toggleEditStructure() {
        this.editStructure = !this.editStructure;
    }
}

export const forumStructureState = new ForumStructureState();

export function groupThreadsBySubSections(threads: Map<number, Thread>) {
    let result = new Map<number, Thread[]>;

    threads.forEach(v => {
        let threadsArray = result.get(v.subSectionId) || [];
        threadsArray.push(v);
        result.set(v.subSectionId, threadsArray);
    });

    result.forEach(l => {
        l.sort((a, b) => b.lastMessageDateTime - a.lastMessageDateTime);
    });

    return result;
}

class NewSectionState {
    constructor() {
        makeObservable(this);
    }

    sectionName = new TextField();
    @observable isOpen = false;

    @action.bound
    showDialog() {
        this.sectionName.value = "";
        this.isOpen = true;
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    create(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/section", {name: this.sectionName.value}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                forumStructureEvent$.next("sectionCreated");
            }
        });
    }
}

class NewSubsectionState {
    constructor() {
        makeObservable(this);
    }

    subsectionName = new TextField();
    @observable isOpen = false;
    @observable section: Section | null;

    @action.bound
    showDialog(section: Section) {
        this.subsectionName.value = "";
        this.isOpen = true;
        this.section = section;
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    create(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/subsection", {name: this.subsectionName.value, sectionId: this.section!.id}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                forumStructureEvent$.next("subsectionCreated");
            }
        });
    }
}

class RenameSectionState {
    constructor() {
        makeObservable(this);
    }

    newSectionName = new TextField();
    @observable isOpen = false;
    @observable section: Section | null;

    @action.bound
    showDialog(section: Section) {
        this.newSectionName.value = section.name;
        this.section = section;
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

        ajax.post<string>("/api/section/rename", {name: this.newSectionName.value, sectionId: this.section!.id}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                forumStructureEvent$.next("sectionRenamed");
            }
        });
    }
}

class RenameSubsectionState {
    constructor() {
        makeObservable(this);
    }

    newSubsectionName = new TextField();
    @observable isOpen = false;
    @observable subsection: SubSection | null;

    @action.bound
    showDialog(subsection: SubSection) {
        this.newSubsectionName.value = subsection.name;
        this.subsection = subsection;
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

        ajax.post<string>("/api/subsection/rename", {name: this.newSubsectionName.value, subsectionId: this.subsection!.id}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                forumStructureEvent$.next("subsectionRenamed");
            }
        });
    }
}

class MoveSubsectionState {
    constructor() {
        makeObservable(this);
    }

    @observable subsection: SubSection | null = null;
    @observable isOpen = false;
    @observable newSectionId = -1;

    @action.bound
    showDialog(subsection: SubSection) {
        this.subsection = subsection;
        this.isOpen = true;
        this.newSectionId = subsection.sectionId;
    }

    @action.bound
    hideDialog() {
        this.isOpen = false;
    }

    @action.bound
    onSectionChange(event: React.ChangeEvent<HTMLSelectElement>) {
        let sectionId = +event.target.value;

        let section = forumStructureState.sections.get(sectionId);
        if (section) {
            this.newSectionId = sectionId;
        }
    }

    @action.bound
    move(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        ajax.post<string>("/api/subsection/move", {subsectionId: this.subsection!.id, newSectionId: this.newSectionId}).pipe(switchMap(filterErrors)).subscribe(v => {
            if (v == "OK") {
                this.hideDialog();
                forumStructureEvent$.next("subsectionMoved");
            }
        });
    }
}

export class SubselectionSelectState {
    constructor() {
        makeObservable(this);
    }
    @observable subsection: SubSection | null;

    @action.bound
    onSubsectionChange(event: React.ChangeEvent<HTMLSelectElement>) {
        let subsectionId = +event.target.value;

        let subsection = forumStructureState.subSections.get(subsectionId);
        if (subsection) {
            this.subsection = subsection;
        }
    }
}

export const newSectionState = new NewSectionState();
export const newSubsectionState = new NewSubsectionState();
export const renameSectionState = new RenameSectionState();
export const renameSubsectionState = new RenameSubsectionState();
export const moveSubsectionState = new MoveSubsectionState();

export const NewSectionDialog = observer(() => {
    if (!newSectionState.isOpen)
        return null;

    return <SmallDialog
        onClose={newSectionState.hideDialog}
        title={"New section"}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"Section name"}</label>
                    <input type="text" id="aligned-name" placeholder="Section name" value={newSectionState.sectionName.value} onChange={newSectionState.sectionName.onChange}/>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={newSectionState.create}
                            disabled={!newSectionState.sectionName.value}
                    >{"Create"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});

export const RenameSectionDialog = observer(() => {
    if (!renameSectionState.isOpen)
        return null;

    return <SmallDialog
        onClose={renameSectionState.hideDialog}
        title={`Rename section ${renameSectionState.section.name}`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"New section name"}</label>
                    <input type="text" id="aligned-name" placeholder="Section name" value={renameSectionState.newSectionName.value} onChange={renameSectionState.newSectionName.onChange}/>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={renameSectionState.rename}
                            disabled={!renameSectionState.newSectionName.value}
                    >{"Rename"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});

export const NewSubsectionDialog = observer(() => {
    if (!newSubsectionState.isOpen)
        return null;

    return <SmallDialog
        onClose={newSubsectionState.hideDialog}
        title={`New subsection of section ${newSubsectionState.section.name}`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"Section name"}</label>
                    <input type="text" id="aligned-name" placeholder="Subsection name" value={newSubsectionState.subsectionName.value} onChange={newSubsectionState.subsectionName.onChange}/>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={newSubsectionState.create}
                            disabled={!newSubsectionState.subsectionName.value}
                    >{"Create"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});

export const RenameSubsectionDialog = observer(() => {
    if (!renameSubsectionState.isOpen)
        return null;

    return <SmallDialog
        onClose={renameSubsectionState.hideDialog}
        title={`Rename subsection ${renameSubsectionState.subsection.name}`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-name">{"New subsection name"}</label>
                    <input type="text" id="aligned-name" placeholder="Section name" value={renameSubsectionState.newSubsectionName.value} onChange={renameSubsectionState.newSubsectionName.onChange}/>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={renameSubsectionState.rename}
                            disabled={!renameSubsectionState.newSubsectionName.value}
                    >{"Rename"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});

export const MoveSubsectionDialog = observer(() => {
    if (!moveSubsectionState.isOpen)
        return null;

    return <SmallDialog
        onClose={moveSubsectionState.hideDialog}
        title={`Move subsection ${moveSubsectionState.subsection?.name}`}
    >
        <form className="pure-form pure-form-aligned">
            <fieldset>
                <div className="pure-control-group">
                    <label htmlFor="aligned-section">{"Destination section"}</label>
                    <select id="aligned-section" className={"pure-input-1-2"} value={`${moveSubsectionState.newSectionId}`} onChange={moveSubsectionState.onSectionChange}>
                        {forumStructureState.orderedSections.map(s => <option key={s.id} value={`${s.id}`}>{s.name}</option>)}
                    </select>
                </div>
                <div className="pure-controls">
                    <button type="submit" className="pure-button pure-button-primary"
                            onClick={moveSubsectionState.move}
                            disabled={moveSubsectionState.newSectionId == moveSubsectionState.subsection?.sectionId}
                    >{"Move"}</button>
                </div>
            </fieldset>
        </form>
    </SmallDialog>
});

export const SubsectionSelect = observer((props: {state: SubselectionSelectState, id: string}) => {
    let subsectionOptions = new Array<JSX.Element>();
    subsectionOptions.push(<option key={-1} value={-1} disabled={true}>{"<Select sub-section>"}</option>);

    forumStructureState.orderedSections.forEach(s => {
        let subsections = forumStructureState.subSectionsBySections.get(s.id);
        if (subsections && subsections.length) {
            let options = new Array<JSX.Element>();

            subsections.forEach(ss => {
                options.push(<option key={`${s.id}_${ss.id}`} value={`${ss.id}`}>{ss.name}</option>);
            });

            subsectionOptions.push(<optgroup key={s.id} label={s.name}>
                    {options}
                </optgroup>
            );
        }
    });

    return <select id={props.id} className={"pure-input-1-2"} value={`${props.state.subsection ? props.state.subsection.id : -1}`} onChange={props.state.onSubsectionChange}>
        {subsectionOptions}
    </select>;
});