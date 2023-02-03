import {action, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";
import {filterErrors, getSessionCookie, queryUserSessions, UserSession, UserSessions} from "./requests";
import {currentUserState} from "./currentUser";
import * as React from "react";
import {EMPTY, switchMap} from "rxjs";
import {currentAddress, USER_PROFILE_PATH} from "./router";
import {ajax} from "rxjs/ajax";

class UserSessionsState {
    constructor() {
        makeObservable(this);

        currentAddress.pageAddress$.pipe(
            switchMap(v => {
                if (v.template == USER_PROFILE_PATH)
                    return queryUserSessions();

                return EMPTY;
            })
        ).subscribe(this.updateUserSessions);
    }

    @observable userSessions: UserSession[] = [];

    @action.bound
    updateUserSessions(sessions: UserSessions) {
        this.userSessions = sessions.sessions;
    }

    @action.bound
    removeSession(session: string) {
        ajax.post<UserSessions>("/api/current-user-sessions/remove", {session}).pipe(switchMap(filterErrors)).subscribe(v => {
            runInAction(() => {
                this.userSessions = v.sessions;
            });
        })
    }
}

export const userSessionsState = new UserSessionsState();

export const UserForm = observer(() => {
    let currentSession = getSessionCookie();

    return <>
        <h1>{"Sessions"}</h1>

        <table className={"forum-table user-sessions-tab"}>
            <thead>
            <tr>
                <th>{"Session"}</th>
                <th></th>
            </tr>
            </thead>
            <tbody>
            {userSessionsState.userSessions.map(v => {
                return <tr key={v.session}>
                    <td>{v.session}</td>
                    <td>
                        {v.session != currentSession && <a className={"action-link"} href={"##"} onClick={() => userSessionsState.removeSession(v.session)}>{"Remove"}</a>}
                    </td>
                </tr>
            })}
            </tbody>
        </table>

        {currentUserState.currentUser && <p><a className={"action-link"} href={"##"} onClick={() => currentUserState.logout(false)}>{"Logout"}</a></p>}
        {currentUserState.currentUser && userSessionsState.userSessions.length > 1 && <p><a className={"action-link"} href={"##"} onClick={() => currentUserState.logout(true)}>{"Logout from all sessions"}</a></p>}
    </>
});