# Question bank: import template

Where: sign in as the teacher, open `/ar/teacher/bank`, pick the lesson, paste the lines into the import box and press import.
The page then tells you how many lines were saved and which line numbers were refused.

## The format (one question per line)

```
السؤال | خيار 1;خيار 2;خيار 3;خيار 4 | رقم الخيار الصحيح | الدرجة
```

- Fields are split by `|`. Choices are split by `;` (2 to 6 choices).
- The correct answer is the **number** of the choice, counting from 1.
- Marks are optional (default 1, at most 100).
- Short answer (no choices): leave the second field empty and put the accepted answer third.
- Explanations cannot be imported; add them afterwards in the question form.

## Copy these to try it (math, grade 12)

```
مشتقة x² تساوي؟ | x;2x;x²;2 | 2 | 1
قيمة sin(90°) تساوي؟ | 0;1;-1;½ | 2 | 1
إذا كان f(x) = 3x + 2 فإن f(2) يساوي؟ | 6;8;5;7 | 2 | 1
ميل المستقيم y = -4x + 1 هو؟ | 1;4;-4;-1 | 3 | 1
ناتج ∫ 2x dx هو؟ | x² + C;2x² + C;x + C;2 + C | 1 | 2
اكتب قيمة log₁₀(1000) | | 3 | 1
```

## Rules for good questions
- Exactly one correct answer; wrong answers that look plausible; no "all of the above".
- About 20 questions per lesson. Start with 5 on one lesson, then check it as a student: the practice appears after the lesson.
- Never copy questions from copyrighted exam papers.
