grammar SlideDeck

entry Presentation:
    (metadata=Metadata)?
    (slides=SlideSection)?;

SlideSection:
    (SLIDE_SEPARATOR)? slides+=Slide (SLIDE_SEPARATOR slides+=Slide)* (SLIDE_SEPARATOR)?;

Metadata:
    '{' 'author' ':' author=STRING 'title' ':' title=STRING ('theme' ':' theme=STRING)? ('logo' ':' logo=STRING)? ('css' ':' css=STRING)? 
    ('transition' ':' transition=STRING)?
    ('chalkboard' ':' chalkboard=STRING)? ('chalkboard-theme' ':' chalkboardTheme=STRING)? 
    ('chalkboard-boardmarker-width' ':' chalkboardBoardmarkerWidth=STRING)? ('chalkboard-chalk-width' ':' chalkboardChalkWidth=STRING)? 
    ('chalkboard-chalk-effect' ':' chalkboardChalkEffect=STRING)? ('chalkboard-src' ':' chalkboardSrc=STRING)? 
    ('chalkboard-readonly' ':' chalkboardReadonly=STRING)? ('chalkboard-buttons' ':' chalkboardButtons=STRING)? 
    ('chalkboard-transition' ':' chalkboardTransition=STRING)? '}';

Slide:
    (transition=TRANSITION_ATTR)? blocks+=Block+;

Block:
    Quiz | lines+=LineContent+;

LineContent:
    FragmentElement | NestedStyledElement | StyledElement | Header | List | Quote | Media | Paragraph | CodeBlock | SyncFragments | Editor | Output | QrCode;

CodeBlock:
    content=CODE_BLOCK;

SyncFragments:
    (opening=SYNC_DELIMITER_KEEP | opening=SYNC_DELIMITER) fragments+=FragmentItem (FRAGMENT_SEPARATOR fragments+=FragmentItem)* (closing=SYNC_DELIMITER_KEEP | closing=SYNC_DELIMITER);

FragmentItem:
    text=PARAGRAPH_TEXT | media=MEDIA_LINE;

FragmentElement:
    STYLE_DELIMITER fragment=FRAGMENT_ATTRS elements+=(FragmentElement | StyledElement | Header | List | Quote | Media | Paragraph | CodeBlock | SyncFragments | Editor | Output | QrCode)+ STYLE_DELIMITER;

NestedStyledElement:
    NESTED_STYLE_DELIMITER (style=STYLE_ATTRS)? elements+=(FragmentElement | StyledElement | Header | List | Quote | Media | Paragraph | CodeBlock | SyncFragments | Editor | Output | QrCode)+ NESTED_STYLE_DELIMITER;

StyledElement:
    STYLE_DELIMITER (style=STYLE_ATTRS)? elements+=(FragmentElement | Header | List | Quote | Media | Paragraph | CodeBlock | SyncFragments | Editor | Output | QrCode)+ STYLE_DELIMITER;

List:
    items+=(UnorderedListItem | OrderedListItem)+;

Header:
    level=HEADER_LEVEL text=PARAGRAPH_TEXT;

UnorderedListItem:
    marker=LIST_MARKER text=PARAGRAPH_TEXT;

OrderedListItem:
    number=INT '.' text=PARAGRAPH_TEXT;

Paragraph:
    text=PARAGRAPH_TEXT;

Quote:
    marker='>' text=PARAGRAPH_TEXT;

Media:
    content=MEDIA_LINE;

Editor:
    IDE_START language=EditorLanguage
    (placeholder=CODE_BLOCK)?
    ('output' ':' output=[Output:STRING])?
    IDE_DELIMITER;

Output:
    'output' ':' id=STRING;

EditorLanguage returns string:
    'python' | 'sql' | 'javascript';

QrCode:
    '![QR]' data=STRING;

Quiz:
    QUIZ_START title=STRING
    ('showJoinQrCode' ':' showJoinQrCode=BOOLEAN)?
    questions+=QuizQuestion+
    STYLE_DELIMITER;

QuizQuestion:
    'question' ':' text=STRING
        choices+=Choice+
        ('correct' ':'
            correctAnswers+=[Choice:STRING]+)?
    ('showResultsOnDemand' ':' showResultsOnDemand=BOOLEAN)?
    ('visualization' ':' visualizationType=VisualizationType)?;

Choice:
    'choice' choice=STRING ':' text=STRING;

VisualizationType returns string:
    'barChart' | 'pieChart';

terminal CODE_BLOCK returns string:
    /```[a-zA-Z0-9_\-]*(?:\s*\[(?:(?:highlight:\s*(?:block|function|class|line-by-line|all|none))|(?:lines:\s*["'][^"']+["'])|(?:start:\s*\d+)|\s)+\])?[\r\n]([\s\S]*?)```/;

terminal QUIZ_START: /:::quiz/;
terminal SYNC_DELIMITER_KEEP: /:::\[sync-fragments\s+keep\]/;
terminal SYNC_DELIMITER: /:::\[sync-fragments\]/;

terminal FRAGMENT_SEPARATOR: /\[\-\-\-\]/;

terminal MEDIA_LINE returns string:
    /!\[[^\]]+\]\([^\)]+\)(?:[ \t]*\{offset:[ \t]*'[-+]?\d+(?:\.\d+)?px[ \t]+[-+]?\d+(?:\.\d+)?px'\})?/;

terminal TRANSITION_ATTR returns string:
    /\{transition:\s*["'][^"']+["']\}/;

terminal FRAGMENT_ATTRS returns string:
    /\{animate:\s*["'][^"']+["'](?:\s+index:\s*\d+)?\}/;

terminal STYLE_ATTRS returns string:
    /\{[^\}\r\n]+\}/;

terminal IDE_START: /,,,ide/;
terminal IDE_DELIMITER: /,,,/;

terminal NESTED_STYLE_DELIMITER: /::::/;

terminal STYLE_DELIMITER: /:::/;

terminal SLIDE_SEPARATOR: /===[\t ]*\r?\n/;

terminal HEADER_LEVEL: /###|##|#/;

terminal LIST_MARKER: /[\-\*\+]/;

terminal BOOLEAN returns boolean:
    /true|false/;

terminal PARAGRAPH_TEXT returns string:
    /(?!(###|##|#)[ \t]+)(?![ \t]*[\-\*\+][ \t]+)(?![ \t]*[0-9]+\.[ \t]+)(?![ \t]*\/(?:\/|\*))(?!>)(?!\!\[[^\]]+\]\()(?!:::)(?!```)(?!,,,)(?!===)(?!---)(?!\[\-\-\-\])(?![\s]*\{)(?![\s]*\})(?![ \t]*!\[QR\])(?![\s]*true)(?![\s]*false)(?![\s]*author)(?![\s]*title)(?![\s]*css)(?![\s]*logo)(?![\s]*theme)(?![\s]*transition)(?![\s]*chalkboard)(?![\s]*python)(?![\s]*sql)(?![\s]*javascript)(?![\s]*output)(?![\s]*question)(?![\s]*freeText)(?![\s]*choice)(?![\s]*choices)(?![\s]*correct)(?![\s]*results)(?![\s]*showResultsOnDemand)(?![\s]*showJoinQrCode)(?![\s]*visualization)(?![\s]*maxLength)(?![\s]*barChart)(?![\s]*pieChart)(?![\s]*:)(?!")(?!\.)[^\r\n]+/;

terminal STRING returns string:
    /"(?:\\.|[^"\\])*"/;

terminal INT returns number:
    /[0-9]+/;

hidden terminal NEWLINE:
    /\r?\n/;

hidden terminal WS:
    /[ \t]+/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
