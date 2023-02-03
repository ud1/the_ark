import {action, computed, makeObservable, observable} from "mobx";
import {combineLatest, startWith, switchMap} from "rxjs";
import {queryThreads, Result, Thread, ThreadQueryResult} from "./requests";
import {currentAddress} from "./router";
import {forumStructureState, groupThreadsBySubSections} from "./forumStructure";
import {threadEvent$} from "./events";

class ThreadListState {
    constructor() {
        makeObservable(this);

        combineLatest([threadEvent$.pipe(startWith("start")), currentAddress.pageAddress$], (e, a) => a).pipe(
            switchMap(v => {
                return queryThreads(v);
            })
        ).subscribe(this.updateThreads);
    }

    currentPageThreads = observable(new Map<number, Thread>());
    @observable totalCurrentPageThreads = 0;

    @action.bound
    updateThreads(threads: Result<ThreadQueryResult>) {
        if ("result" in threads) {
            this.currentPageThreads.clear();
            threads.result.threads.forEach(t => this.currentPageThreads.set(t.id, t));
            this.totalCurrentPageThreads = threads.result.count;
        }
    }

    @computed
    get currentPageThreadsBySubSections() {
        return groupThreadsBySubSections(this.currentPageThreads);
    }

    getThreadsBySectionCount(sectionId: number) {
        let result = 0;
        let threads = this.currentPageThreadsBySubSections;
        let subsections = forumStructureState.subSectionsBySections.get(sectionId);
        if (subsections) {
            subsections.forEach(s => {
                let subsectionThreads = threads.get(s.id);
                if (subsectionThreads)
                    result += subsectionThreads.length;
            });
        }

        return result;
    }
}

export const threadListState = new ThreadListState();