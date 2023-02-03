import {ajax} from "rxjs/ajax";
import {UploadedFiles} from "./requests";
import {runInAction} from "mobx";
import {currentUserState} from "./currentUser";
import {ARTICLE_PATH, ARTICLES_PATH, currentAddress, ROOT_PATH, SECTION_PATH, SUBSECTION_PATH, THREAD_PATH} from "./router";
import {newMessageState, updateMessageState} from "./message";
import {newThreadState} from "./threadCreate";
import {createUpdateArticleState} from "./article";

export interface FileUploadable {
    fileUploaded(mdLinks: string);
}

export function uploadFiles(fileUploadable: FileUploadable, e: ClipboardEvent) {
    let filesCount = 0;
    let formData = new FormData();

    for (let v of Array.from(e.clipboardData.items)) {
        var blob = v.getAsFile();
        if (blob) {
            formData.append("file_set[]", blob);
            filesCount++;
        }
    }

    if (filesCount > 0) {
        ajax.post<UploadedFiles>("/api/upload-files", formData).subscribe(v => {
            if (v.response) {
                runInAction(() => {
                    for (let f of v.response.files) {
                        let fileName = f.fileName.replace("\"", " ");

                        if (f.mime.startsWith("image/")) {
                            fileUploadable.fileUploaded(`\n![${f.fileName}](/files/${f.id} "${fileName}")`);
                        }
                        else {
                            fileUploadable.fileUploaded(`\n[${f.fileName}](/files/${f.id} "${fileName}")`);
                        }
                    }
                });
            }
        });
    }
}

function getCurrentFileUploadable() : FileUploadable | null {
    if (!currentUserState.currentUser)
        return null;

    if (currentAddress.address.template == THREAD_PATH) {
        if (updateMessageState.isOpen)
            return updateMessageState;

        return newMessageState;
    }

    if (newThreadState.isOpen) {
        if (currentAddress.address.template == ROOT_PATH
            || currentAddress.address.template == SECTION_PATH
            || currentAddress.address.template == SUBSECTION_PATH) {
            return newThreadState;
        }
    }

    if ((currentAddress.address.template == ARTICLE_PATH || currentAddress.address.template == ARTICLES_PATH) && createUpdateArticleState.isOpen) {
        return createUpdateArticleState;
    }

    return null;
}

window.addEventListener("paste", function(e: ClipboardEvent) {
    let fileUploadable = getCurrentFileUploadable();
    if (!fileUploadable) {
        return;
    }

    uploadFiles(fileUploadable, e);
});
