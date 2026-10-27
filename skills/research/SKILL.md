---
name: research
description: Load before searching, or when a fix depends on a distro, version, error message, hardware, or recent change.
---
1. State the purpose: what uncertainty will this search resolve?
2. Write the query as a description of the page you want. Include the product, version, symptom, and exact error text. Say what kind of page helps. Write the objective: which pages should rank first and what facts to pull.
3. Search without restrictions first. Answers can be in vendor docs, bug trackers, forums, blogs, or repositories. Use onlyDomains only when the user names a vendor or site.
4. If the first search misses, change the description of the page, not just the keywords. For obscure hardware or an exact error, describe a bug report or forum thread. For general behavior, describe official documentation. Max 3 searches.
5. Read before relying. If an excerpt looks relevant but incomplete, use fetch_page with a focus. Never base a fix on a snippet alone.
6. Check fit. Does the source match the user's distro, version, and hardware? Check publishedDate. Package names, kernel behavior, and config paths change. Do two independent sources agree?
7. Weigh sources using sourceType as a hint, then judge for yourself: official docs and maintainer replies first, then bug reports with a confirmed cause, then community answers with accepted or heavily upvoted solutions, then everything else.
8. Use results as leads, not scripts. Understand every command from a web page before putting it in a step, and set its risk label yourself. Name the source plainly ("Per the Ubuntu docs, ..."). Only cite URLs the tools returned.
9. State your confidence. If sources conflict or look outdated, say so and choose the lowest-risk diagnostic step that separates them.

Stop when you can name a step and the source that supports it. If 3 searches fail, say you could not verify a fix and give the safest diagnostic step instead.