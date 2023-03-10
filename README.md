
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

## Поиск
Поиск, в зависимости от текущей страницы, может быть либо по телу сообщений форума, либо по статьям.

При поиске надо указывать либо слова целиком, либо используя префикс и символ `*`

```
searchWord*
```

Так же поддерживаются кодовые слова `AND`, `OR` и `NOT`

```
searchWord1 AND searchWord2
searchWord1 OR searchWord2
searchWord1 NOT searchWord2
```

Для вставки файла надо скопировать его в буфер обмена и нажать на Ctrl-C.

## Статьи
Статьи могут хранится в виде дерева, в поле `Path` при создании статьи надо указывать путь в дереве,
путь состоит из одного или нескольких сегментов разделенных символом `/`.

Можно сделать статью избранной, тогда она будет отображаться в левой панели (если пользователь залогинен).

Можно создавать приватные статьи, они будут видны только создавшему их пользователю.

## Форум
Форум состоит из секций, которые состоят из субсекций, и в субсекциях уже могут создаваться треды. Тем самым используется жесткая двухуровневая система.

Для редактирования секций и субсекций надо нажать на иконку шестеренок в шапке страницы, левее поля поиска.
