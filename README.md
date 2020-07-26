# indigo-book-converter

THis is a bare-bones proof-of-concept demo of conversion from a document saved
from Word as "Web Page" to cleaner HTML, while preserving (or transforming)
selected features of the original.

To try it out, clone this repository, enter the top-level directory,
install the dependencies, and try ``npm run original`` and ``npm run convert``
respectively.

1. ``git clone https://github.com/fbennett/indigo-book-converter.git``
2. ``cd indigo-book-converter``
3. ``npm install``
4. ``npm run original``
5. ``npm run convert``

There is plenty of information in the original HTML that can be used
to clean up weirdness like the mis-structuring of the numbered list.
