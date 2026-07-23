/*  ---------------------------------------------------
    Template Name: Ogani
    Description:  Ogani eCommerce  HTML Template
    Author: Colorlib
    Author URI: https://colorlib.com
    Version: 1.0
    Created: Colorlib
---------------------------------------------------------  */

'use strict';

(function ($) {

    /*------------------
        Preloader — hide on DOM ready (not window load) so we do not wait for all images.
    --------------------*/
    $(function () {
        $(".loader").stop(true, true).fadeOut(150);
        $("#preloder").fadeOut(200);

        if ($('.featured__filter').length > 0) {
            var containerEl = document.querySelector('.featured__filter');
            if (!containerEl.hasAttribute('data-dynamic') && typeof window.mixitup === 'function') {
                window.mixitup(containerEl);
            }
        }
    });

    /*------------------
        Background Set — lazy load via IntersectionObserver for below-the-fold
        elements (e.g. category tiles) so we don't download all background
        images on page load. The hero on the homepage is now a real
        <picture>/<img> element with fetchpriority=high so it does not need a
        background-image swap; only category tiles and breadcrumbs use this.
    --------------------*/
    function applyBg($el) {
        if ($el.attr('data-bg-applied') === '1') return;
        var bg = $el.data('setbg');
        if (!bg) return;
        $el.css('background-image', 'url(' + bg + ')');
        $el.attr('data-bg-applied', '1');
    }

    // Eagerly load the shop/account/blog breadcrumb hero (it is above the fold
    // on those pages). The homepage hero is now an <img> and handles itself.
    $('.breadcrumb__item.set-bg').each(function () {
        applyBg($(this));
    });

    var bgObserver = null;
    if ('IntersectionObserver' in window) {
        bgObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    applyBg($(entry.target));
                    bgObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '200px 0px' });

        $('.set-bg').each(function () {
            if ($(this).attr('data-bg-applied') === '1') return;
            bgObserver.observe(this);
        });
    } else {
        // Fallback: load everything immediately.
        $('.set-bg').each(function () { applyBg($(this)); });
    }

    //Humberger Menu — locks body scroll so the page behind doesn't scroll on iOS.
    var $humbergerWrap = $(".humberger__menu__wrapper");
    function lockHumbergerScroll() {
        if ($humbergerWrap.attr('data-scroll-locked') === '1') return;
        $humbergerWrap.attr('data-scroll-locked', '1');
        if (window.__milladScrollLock) window.__milladScrollLock.lock();
    }
    function unlockHumbergerScroll() {
        if ($humbergerWrap.attr('data-scroll-locked') !== '1') return;
        $humbergerWrap.removeAttr('data-scroll-locked');
        if (window.__milladScrollLock) window.__milladScrollLock.unlock();
    }
    $(".humberger__open").on('click', function () {
        $(".humberger__menu__wrapper").addClass("show__humberger__menu__wrapper");
        $(".humberger__menu__overlay").addClass("active");
        $("body").addClass("over_hid");
        lockHumbergerScroll();
    });

    $(".humberger__menu__overlay").on('click', function () {
        $(".humberger__menu__wrapper").removeClass("show__humberger__menu__wrapper");
        $(".humberger__menu__overlay").removeClass("active");
        $("body").removeClass("over_hid");
        unlockHumbergerScroll();
    });

    /*------------------
        Navigation — slicknav builds the mobile-menu drawer.
        Deferred to first hamburger interaction OR to requestIdleCallback so
        it doesn't block initial render. slicknav fires a synchronous layout
        pass that costs ~30 ms TBT on mobile.
    --------------------*/
    var slicknavInitialized = false;
    function initSlicknav() {
        if (slicknavInitialized) return;
        if (typeof $.fn.slicknav !== 'function') return;
        slicknavInitialized = true;
        $(".mobile-menu").slicknav({
            prependTo: '#mobile-menu-wrap',
            allowParentLinks: true
        });
    }
    // Init lazily: on first hamburger click, or after the browser is idle.
    $(document).one('click', '.humberger__open', initSlicknav);
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(initSlicknav, { timeout: 4000 });
    } else {
        setTimeout(initSlicknav, 2500);
    }

    /*-----------------------
        Owl Carousels — init lazily when each carousel scrolls into view, so
        the page's first frame doesn't pay for the layout pass over carousels
        that may be below the fold. The categories slider is usually
        partially visible so it inits almost immediately, but the product/
        details sliders only init on real demand.
    ------------------------*/
    var hasOwl = typeof $.fn.owlCarousel === 'function';
    var owlNavText = [
        '<svg class="icon icon-angle-left" aria-hidden="true"><use href="/img/icons.svg#icon-angle-left"></use></svg>',
        '<svg class="icon icon-angle-right" aria-hidden="true"><use href="/img/icons.svg#icon-angle-right"></use></svg>'
    ];

    var owlInitObserver = null;
    function lazyOwl(selector, config) {
        if (!hasOwl) return;
        var $el = $(selector);
        if (!$el.length) return;
        function init() {
            if ($el.attr('data-owl-init') === '1') return;
            $el.attr('data-owl-init', '1');
            $el.owlCarousel(config);
        }
        if (!('IntersectionObserver' in window)) { init(); return; }
        if (!owlInitObserver) {
            owlInitObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var fn = entry.target.__owlInit;
                        if (typeof fn === 'function') fn();
                        owlInitObserver.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '200px 0px' });
        }
        $el.each(function () {
            this.__owlInit = init;
            owlInitObserver.observe(this);
        });
    }

    lazyOwl('.categories__slider', {
        loop: true,
        margin: 0,
        items: 4,
        dots: false,
        nav: true,
        navText: owlNavText,
        animateOut: 'fadeOut',
        animateIn: 'fadeIn',
        smartSpeed: 1200,
        autoHeight: false,
        autoplay: true,
        responsive: {
            0: { items: 1 },
            480: { items: 2 },
            768: { items: 3 },
            992: { items: 4 }
        }
    });

    $(".categories__slider").on('initialized.owl.carousel translated.owl.carousel', function () {
        $(this).find('.categories__item.set-bg').each(function () {
            if ($(this).attr('data-bg-applied') === '1') return;
            if (bgObserver) bgObserver.observe(this);
            else applyBg($(this));
        });
    });


    // Categories dropdown — CSS-class toggle (no jQuery animation reads layout
    // synchronously, which was costing ~100 ms of forced reflow in PSI).
    // The .hero__categories--open class triggers a max-height + opacity
    // transition declared in css/style.css.
    $('.hero__categories__all').on('click', function () {
        $(this).closest('.hero__categories').toggleClass('hero__categories--open');
    });

    // Close the dropdown after a category is picked (shop page client-side
    // filtering doesn't reload so the absolute-positioned <ul> would stick
    // around otherwise).
    $(document).on('click', '.hero__categories ul a', function () {
        $(this).closest('.hero__categories').removeClass('hero__categories--open');
    });

    lazyOwl('.latest-product__slider', {
        loop: true,
        margin: 0,
        items: 1,
        dots: false,
        nav: true,
        navText: owlNavText,
        smartSpeed: 1200,
        autoHeight: false,
        autoplay: true
    });

    lazyOwl('.product__discount__slider', {
        loop: true,
        margin: 0,
        items: 3,
        dots: true,
        smartSpeed: 1200,
        autoHeight: false,
        autoplay: true,
        responsive: {
            320: { items: 1 },
            480: { items: 2 },
            768: { items: 2 },
            992: { items: 3 }
        }
    });

    lazyOwl('.product__details__pic__slider', {
        loop: true,
        margin: 20,
        items: 4,
        dots: true,
        smartSpeed: 1200,
        autoHeight: false,
        autoplay: true
    });

    /*-----------------------
        Price Range Slider — only runs on pages that include the .price-range
        element AND that loaded jquery-ui. This keeps index.html lean.
    ------------------------ */
    var rangeSlider = $(".price-range");
    if (rangeSlider.length && typeof rangeSlider.slider === 'function') {
        var minamount = $("#minamount"),
            maxamount = $("#maxamount"),
            minPrice = rangeSlider.data('min'),
            maxPrice = rangeSlider.data('max');
        rangeSlider.slider({
            range: true,
            min: minPrice,
            max: maxPrice,
            values: [minPrice, maxPrice],
            slide: function (event, ui) {
                minamount.val('$' + ui.values[0]);
                maxamount.val('$' + ui.values[1]);
            }
        });
        minamount.val('$' + rangeSlider.slider("values", 0));
        maxamount.val('$' + rangeSlider.slider("values", 1));
    }

    /*--------------------------
        Select — only enhance when nice-select is loaded.
    ----------------------------*/
    if (typeof $.fn.niceSelect === 'function') {
        $("select").niceSelect();
    }

    /*------------------
		Single Product
	--------------------*/
    $('.product__details__pic__slider img').on('click', function () {

        var imgurl = $(this).data('imgbigurl');
        var bigImg = $('.product__details__pic__item--large').attr('src');
        if (imgurl != bigImg) {
            $('.product__details__pic__item--large').attr({
                src: imgurl
            });
        }
    });

    /*-------------------
		Quantity change
	--------------------- */
    var proQty = $('.pro-qty');
    proQty.prepend('<span class="dec qtybtn">-</span>');
    proQty.append('<span class="inc qtybtn">+</span>');
    proQty.on('click', '.qtybtn', function () {
        var $button = $(this);
        var oldValue = $button.parent().find('input').val();
        if ($button.hasClass('inc')) {
            var newVal = parseFloat(oldValue) + 1;
        } else {
            // Don't allow decrementing below zero
            if (oldValue > 0) {
                var newVal = parseFloat(oldValue) - 1;
            } else {
                newVal = 0;
            }
        }
        $button.parent().find('input').val(newVal);
    });

})(jQuery);