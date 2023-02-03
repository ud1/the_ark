import * as React from 'react';
import {observer} from "mobx-react";
import WinBox from 'react-winbox';
import {currentAddress, makePath, makeUrl, PageAddress} from "./router";
import {action, makeObservable, observable} from "mobx";
import {sortBy, uniq} from "lodash";

export const SmallDialog = observer((props: {
    onClose: (force: boolean) => boolean | undefined | void,
    title: string,
    children: JSX.Element,
}) => {
    return <WinBox
        width={800}
        x="center"
        y="center"
        onClose={props.onClose}
        title={props.title}
        noMin={true}
        noFull={true}
        noResize={true}
    >
        {props.children}
    </WinBox>
});

export const LargeDialog = observer((props: {
    onClose: (force: boolean) => boolean | undefined | void,
    title: string,
    children: JSX.Element,
}) => {
    return <WinBox
        width={1200}
        height={800}
        x="center"
        y="center"
        onClose={props.onClose}
        title={props.title}
        noMin={true}
        noFull={true}
    >
        {props.children}
    </WinBox>
});

export const Link = observer((props: React.PropsWithChildren<{address: PageAddress}>) => {
    let params: {[k: string] : string} = {};
    for (let k in props.address) {
        let v = props.address[k];
        if (typeof v == "string")
            params[k] = v;
    }

    const queryParams = props.address["params"] ? new Map(Object.entries(props.address["params"])) : null;

    let url = makeUrl(makePath(props.address.template.split("/"), params), queryParams, props.address["hash"]);

    return <a className={"inner-link"} href={url} onClick={(e) => {
        e.preventDefault();
        currentAddress.goTo(props.address);
    }}>
        {props.children}
    </a>
});

export class TextField {
    constructor() {
        makeObservable(this);
    }

    @observable value = "";

    @action.bound
    onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.value = ev.target.value;
    }
}

interface PagingProps {
    currentPage: number,
    totalPages: number,
    includeFirstPage: boolean,
    hasNextButton: boolean,
    linkRenderer: (page: number, isNextButton: boolean) => any,
}

export const Paging = (props: PagingProps) => {
    let pages = new Array<number>();

    for (let i = 1; i <= Math.min(3, props.totalPages); ++i) {
        pages.push(i);
    }

    for (let i = Math.max(1, props.currentPage - 2); i <= Math.min(props.currentPage + 2, props.totalPages); ++i) {
        pages.push(i);
    }

    for (let i = Math.max(1, props.totalPages - 3); i <= props.totalPages; ++i) {
        pages.push(i);
    }

    pages = uniq(sortBy(pages));

    let result: any[] = [];

    let prev = 1;
    for (let page of pages) {
        if (page == 1 && !props.includeFirstPage) {
            continue;
        }

        if (prev + 1 < page) {
            result.push("...")
        }

        if (page != props.currentPage) {
            result.push(props.linkRenderer(page, false));
        }
        else {
            result.push(`${page}`)
        }

        prev = page;
    }

    if (props.hasNextButton && props.currentPage < props.totalPages) {
        result.push(props.linkRenderer(props.currentPage + 1, true));
    }

    let resultWithSpaces: JSX.Element[] = [];
    for (let i = 0; i < result.length; ++i) {
        if (i > 0)
            resultWithSpaces.push(<span key={"s" + i}>{" "}</span>);
        resultWithSpaces.push(<span key={"p" + i}>{result[i]}</span>);
    }

    return <span className={"pages"}>{resultWithSpaces}</span>
};

