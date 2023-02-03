import {action, computed, makeObservable, observable, reaction, runInAction} from "mobx";
import {filterErrors, queryCurrentUser, User} from "./requests";
import {ajax} from "rxjs/ajax";
import {switchMap} from "rxjs";
import {currentAddress, ROOT_PATH, SIGNUP_PATH} from "./router";
import * as React from "react";
import {sha256} from "js-sha256";
import {observer} from "mobx-react";
import {Link} from "./components";
import {currentUserEvent$} from "./events";

class CurrentUserState {
    constructor() {
        makeObservable(this);

        queryCurrentUser().subscribe(u => {
            this.setCurrentUser(u);
            currentUserEvent$.next("loggedOn");
        });
    }

    @observable currentUser: User | null = null;

    @action.bound
    setCurrentUser(user: User | null) {
        this.currentUser = user;
    }

    @action.bound
    logout(removeAllSessions: boolean) {
        ajax.post<string>("/api/logout", {removeAllSessions}).pipe(switchMap(filterErrors)).subscribe(v => {
            runInAction(() => {
                this.currentUser = null;
                currentAddress.goTo({template: ROOT_PATH, params: {}});
            });
            currentUserEvent$.next("loggedOff");
        });
    }
}

class LoginState {
    constructor() {
        makeObservable(this);

        reaction(() => currentAddress.address.template, t => {
            if (t == SIGNUP_PATH) {
                this.loginDialogVisible = false;
            }
        });
    }

    @action.bound
    toggleLoginDialogVisible() {
        this.loginDialogVisible = !this.loginDialogVisible;
        if (this.loginDialogVisible) {
            this.password = "";
            this.error = "";
        }
    }

    @action.bound
    onChangeLogin(ev: React.ChangeEvent<HTMLInputElement>) {
        this.login = ev.target.value;
    }

    @action.bound
    onChangePassword(ev: React.ChangeEvent<HTMLInputElement>) {
        this.password = ev.target.value;
    }

    @action.bound
    signon(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();

        let hashedPassword = sha256.hmac('[the-ark]', this.password);

        ajax.post<"FAILED" | User>("/signon", {userName: this.login, password: hashedPassword}).subscribe(v => {
            if (v.response == "FAILED") {
                this.error = "Sign on failed";
            }
            else if (v.status == 200) {
                this.error = "";
                this.loginDialogVisible = false;
                currentUserState.setCurrentUser(v.response);
                currentUserEvent$.next("loggedOn");
            }
            else {
                this.error = "Unexpected error";
            }
        });
    }

    @observable loginDialogVisible = false;
    @observable login = "";
    @observable password = "";
    @observable error = "";

    @computed
    get canSignon() {
        return this.login.length > 0 && this.password.length > 0;
    }
}

class SignupState {
    constructor() {
        makeObservable(this);
    }

    @action.bound
    onChangeLogin(ev: React.ChangeEvent<HTMLInputElement>) {
        this.login = ev.target.value;
    }

    @action.bound
    onChangePassword(ev: React.ChangeEvent<HTMLInputElement>) {
        this.password = ev.target.value;
    }

    @action.bound
    onChangePasswordConfirmation(ev: React.ChangeEvent<HTMLInputElement>) {
        this.passwordConfirmation = ev.target.value;
    }

    @action.bound
    signup(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();

        let hashedPassword = sha256.hmac('[the-ark]', this.password);

        ajax.post("/signup", {userName: this.login, password: hashedPassword}).subscribe(v => {
            runInAction(() => {
                if (v.response == "OK") {
                    this.error = "";
                    currentAddress.goTo({template: ROOT_PATH, params: {}});
                }
                else if (v.response == "FAILED") {
                    this.error = "Sign up failed";
                }
                else {
                    this.error = "Unexpected error";
                }
            });
        });
    }

    @observable login = "";
    @observable password = "";
    @observable passwordConfirmation = "";
    @observable error = "";

    @computed
    get canSignup() {
        return this.login.length > 0 && this.password.length > 0 && this.password == this.passwordConfirmation;
    }
}

export const currentUserState = new CurrentUserState();
export const loginState = new LoginState();
const signupState = new SignupState();

export const SignonForm = observer((props: {}) => {
    if (!loginState.loginDialogVisible)
        return null;

    return <>
        <div className={"back-drop"}/>
        <div className={"login-dialog"}>
            <form className="pure-form pure-form-stacked">
                <fieldset>
                    <legend>{"Login"}</legend>
                    <label htmlFor="username">{"User name"}</label>
                    <input id="username" placeholder="User name" onChange={loginState.onChangeLogin} value={loginState.login}/>
                    <label htmlFor="password">{"Password"}</label>
                    <input type="password" id="stacked-password" placeholder="Password" onChange={loginState.onChangePassword} value={loginState.password}/>
                    <button className="pure-button pure-button-primary" disabled={!loginState.canSignon}
                            onClick={loginState.signon}>{"Sign in"}</button>
                    {loginState.error &&
                        <span className="pure-form-message error-message">{loginState.error}</span>
                    }

                    <Link address={{template: SIGNUP_PATH}}>{"Sign up"}</Link>
                </fieldset>
            </form>
        </div>
    </>
});

export const SignupForm = observer((props: {}) => {
    return <div className={"signup-form"}>
        <form className="pure-form pure-form-stacked">
            <fieldset>
                <legend>{"Signup"}</legend>
                <label htmlFor="username">{"User name"}</label>
                <input id="username" placeholder="User name" onChange={signupState.onChangeLogin} value={signupState.login}/>
                <label htmlFor="password">{"Password"}</label>
                <input type="password" id="stacked-password" placeholder="Password" onChange={signupState.onChangePassword} value={signupState.password}/>
                <label htmlFor="password">{"Password confirmation"}</label>
                <input type="password" id="stacked-password-confirmation" placeholder="Password confirmation"
                       onChange={signupState.onChangePasswordConfirmation} value={signupState.passwordConfirmation}/>
                <button className="pure-button pure-button-primary" disabled={!signupState.canSignup}
                        onClick={signupState.signup}>{"Sign up"}</button>
                {signupState.error &&
                    <span className="pure-form-message error-message">{signupState.error}</span>
                }
            </fieldset>
        </form>
    </div>
})
