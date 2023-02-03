
# The Ark

Движок форума и хранилище статей. Посты на форуме и статьи пишутся в формате Markdown.

Данные хранятся в sqlite базе.

Сборка

```bash
./crossBuild.sh
```

Запуск
```
# the_ark [port] [host]
./the_ark 8080 127.0.0.1
```

При запуске, при необходимости, автоматом создает папку data с базами данных.

Поиск в зависимости от текущей страницы может быть либо по телу сообщений форума, либо по статьям.

При поиске надо указывать либо слова целиком, либо используя префикс и символ `*`

```
searchWord*
```

Так же поддерживаются кодовые слова `AND`, 'OR' и 'NOT'

```
searchWord1 AND searchWord2
searchWord1 OR searchWord2
searchWord1 NOT searchWord2
```

Для вставки файла надо скопировать его в буфер обмена и нажать на Ctrl-C.