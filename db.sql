CREATE TABLE USER (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   name text NOT NULL
);

CREATE UNIQUE INDEX USER_NAME_INX ON USER(name);

CREATE TABLE SECTION (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   name text NOT NULL,
   deleted BOOLEAN NOT NULL DEFAULT(FALSE)
);

CREATE UNIQUE INDEX SECTION_NAME_INX ON SECTION(name) WHERE deleted = FALSE;

CREATE TABLE SUBSECTION (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   section_id INTEGER NOT NULL,
   name text NOT NULL,
   deleted BOOLEAN NOT NULL DEFAULT(FALSE),
   FOREIGN KEY (section_id) REFERENCES SECTION (id)
);

CREATE UNIQUE INDEX SUBSECTION_NAME_INX ON SUBSECTION(section_id, name) WHERE deleted = FALSE;

CREATE VIRTUAL TABLE THREAD_NAME_FTS USING fts5 (
    name,
    tokenize = "unicode61 tokenchars '-_'"
);

CREATE TABLE THREAD (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   subsection_id INTEGER NOT NULL,
   name_id INTEGER NOT NULL, --> THREAD_NAME_FTS (rowid)
   author_id INTEGER NOT NULL,
   create_time INTEGER NOT NULL,
   update_time INTEGER NOT NULL,
   message_seq INTEGER NOT NULL,
   deleted BOOLEAN NOT NULL DEFAULT(FALSE),
   FOREIGN KEY (subsection_id) REFERENCES SUBSECTION (id),
   FOREIGN KEY (author_id) REFERENCES USER (id)
);

CREATE INDEX THREAD_UPDATE_TIME_INX ON THREAD(update_time);
CREATE INDEX THREAD_SUBSECTION_INX ON THREAD(subsection_id);
CREATE INDEX THREAD_AUTHOR_INX ON THREAD(author_id);

CREATE VIRTUAL TABLE MESSAGE_CONTENT_FTS USING fts5 (
    content,
    tokenize = "unicode61 tokenchars '-_'"
);

CREATE TABLE MESSAGE (
   id INTEGER,
   user_id INTEGER NOT NULL,
   thread_id INTEGER NOT NULL,
   create_time INTEGER NOT NULL,
   update_time INTEGER NOT NULL,
   content_id INTEGER NOT NULL, --> MESSAGE_CONTENT_FTS (rowid)
   FOREIGN KEY (user_id) REFERENCES USER (id),
   FOREIGN KEY (thread_id) REFERENCES THREAD (id)
);

CREATE UNIQUE INDEX MESSAGE_ID_INX ON MESSAGE(thread_id, id);
CREATE INDEX MESSAGE_USER_INX ON MESSAGE(user_id);
CREATE UNIQUE INDEX MESSAGE_CONTENT_INX ON MESSAGE(content_id);


CREATE TABLE FILES (
    id INTEGER NOT NULL, 
    user_id INTEGER NOT NULL,
    file_name text NOT NULL,
    mime text NOT NULL,
    orig_file_name NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USER (id)
);

CREATE INDEX FILES_ID_INX ON FILES(id);
CREATE INDEX FILES_USER_ID_INX ON FILES(user_id);

CREATE VIRTUAL TABLE ARTICLE_CONTENT_FTS USING fts5 (
    name,
    content,
    tokenize = "unicode61 tokenchars '-_'"
);

 -- name & content are not null if active = false, and null if active = true
 -- content_id is null if active = false, and not null if active = true
CREATE TABLE ARTICLE (
    id INTEGER,
    path text NOT NULL,
    content_id INTEGER, --> REFERENCES ARTICLE_CONTENT_FTS (rowid)
    name text,
    content text,
    user_id INTEGER NOT NULL,
    create_time INTEGER NOT NULL,
    version INTEGER NOT NULL,
    active BOOLEAN NOT NULL,
    visibility text NOT NULL, -- public, private
    
    PRIMARY KEY (id, version),
    FOREIGN KEY (user_id) REFERENCES USER (id)
);

CREATE INDEX ARTICLE_USER_INX ON MESSAGE(user_id);
CREATE UNIQUE INDEX ARTICLE_CONTENT_INX ON MESSAGE(content_id); 

CREATE TABLE FAVORITE_ARTICLE (
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (article_id, user_id)
);


CREATE VIRTUAL TABLE ARTICLE_COMMENT_CONTENT_FTS USING fts5 (
    content,
    tokenize = "unicode61 tokenchars '-_'"
);

CREATE TABLE ARTICLE_COMMENT (
   id INTEGER,
   user_id INTEGER NOT NULL,
   article_id INTEGER NOT NULL,
   article_version INTEGER NOT NULL,
   create_time INTEGER NOT NULL,
   update_time INTEGER NOT NULL,
   content_id INTEGER NOT NULL, --> ARTICLE_COMMENT_CONTENT_FTS (rowid)
   FOREIGN KEY (user_id) REFERENCES USER (id),
   FOREIGN KEY (article_id, article_version) REFERENCES ARTICLE (id, version)
);

CREATE UNIQUE INDEX ARTICLE_COMMENT_ID_INX ON ARTICLE_COMMENT(article_id, id);
CREATE INDEX ARTICLE_COMMENT_USER_INX ON ARTICLE_COMMENT(user_id);
CREATE UNIQUE INDEX ARTICLE_COMMENT_CONTENT_INX ON ARTICLE_COMMENT(content_id);

