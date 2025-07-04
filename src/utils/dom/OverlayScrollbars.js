import { OverlayScrollbars } from "overlayscrollbars";

const osOptions = {
    scrollbars: {
        autoHide: "move",
        // autoHideDelay: 2000,
        // autoHideSuspend: true,
    },
    /* update: {
        ignoreMutation: ()=>true,
    } */
};

OverlayScrollbars.env().setDefaultOptions({
    ...osOptions,
})

const scrollableClasses = [ // Your Tailwind classes (or any other classes)
    '.overflow-auto', '.overflow-y-auto', '.overflow-x-auto',
    '.overflow-scroll', '.overflow-y-scroll', '.overflow-x-scroll'
];

const scrollableAttributes = [ // Attributes to trigger initialization
    '[data-overlayscrollbars-initialize]'
];

/** @returns {OverlayScrollbars} */
export function initializeOverlayScrollbars(element) {
    if (!element) return;

    let shouldInitialize = false;

    // Check for classes
    if (element.classList) {
        if (scrollableClasses.some(cls => element.classList.contains(cls.substring(1)))) {
            shouldInitialize = true;
        }
    }

    // Check for attributes
    if (!shouldInitialize) { // Only check attributes if classes didn't match
        if (scrollableAttributes.some(attr => element.matches(attr))) {
            shouldInitialize = true;
        }
    }

    if (shouldInitialize) {
        if (!element.osInstance) {
            element.osInstance = OverlayScrollbars(element, osOptions);
            // console.log('OverlayScrollbars initialized on:', element);
        }
    }
    return element.osInstance;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll([...scrollableClasses, ...scrollableAttributes].join(',')).forEach(initializeOverlayScrollbars);
});

const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node instanceof Element) {
                    initializeOverlayScrollbars(node);
                    node.querySelectorAll([...scrollableClasses, ...scrollableAttributes].join(',')).forEach(initializeOverlayScrollbars);
                }
            });
        } else if (mutation.type === 'attributes' && scrollableAttributes.includes(`[${mutation.attributeName}]`)) {
            initializeOverlayScrollbars(mutation.target);
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            initializeOverlayScrollbars(mutation.target);
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true, attributes: true });

export {OverlayScrollbars};