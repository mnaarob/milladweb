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

        /*------------------
            Gallery filter
        --------------------*/
        $('.featured__controls li').on('click', function () {
            $('.featured__controls li').removeClass('active');
            $(this).addClass('active');
        });
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
        images on page load. The above-the-fold hero (.hero__item) is loaded
        immediately so its image (the LCP) is not delayed.

        For the hero (.hero__item) we pick a responsive variant from the same
        breakpoints used by the <link rel="preload" imagesrcset> tag, so the
        browser hits its preload cache instead of fetching a second copy.
    --------------------*/
    function heroVariantFor(bg) {
        // Only rewrite our hero pattern (images/meat/heroimage2.webp). Other
        // background-image paths pass through unchanged.
        if (!/heroimage2\.webp$/.test(bg)) return bg;
        var w = window.innerWidth || document.documentElement.clientWidth || 1024;
        var dpr = window.devicePixelRatio || 1;
        var effective = w * dpr;
        if (effective <= 640) return bg.replace(/heroimage2\.webp$/, 'heroimage2-640.webp');
        if (effective <= 1024) return bg.replace(/heroimage2\.webp$/, 'heroimage2-1024.webp');
        return bg;
    }

    function applyBg($el) {
        if ($el.attr('data-bg-applied') === '1') return;
        var bg = $el.data('setbg');
        if (!bg) return;
        if ($el.hasClass('hero__item')) bg = heroVariantFor(bg);
        $el.css('background-image', 'url(' + bg + ')');
        $el.attr('data-bg-applied', '1');
    }

    // Eagerly load above-the-fold hero so it competes with no other downloads.
    $('.hero__item.set-bg, .breadcrumb__item.set-bg').each(function () {
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
	--------------------*/
    if (typeof $.fn.slicknav === 'function') {
        $(".mobile-menu").slicknav({
            prependTo: '#mobile-menu-wrap',
            allowParentLinks: true
        });
    }

    /*-----------------------
        Categories Slider — requires owl.carousel. Skip gracefully when absent.
    ------------------------*/
    var hasOwl = typeof $.fn.owlCarousel === 'function';
    var owlNavText = [
        '<svg class="icon icon-angle-left" aria-hidden="true"><use href="/img/icons.svg#icon-angle-left"></use></svg>',
        '<svg class="icon icon-angle-right" aria-hidden="true"><use href="/img/icons.svg#icon-angle-right"></use></svg>'
    ];
    if (hasOwl) $(".categories__slider").owlCarousel({
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

            0: {
                items: 1,
            },

            480: {
                items: 2,
            },

            768: {
                items: 3,
            },

            992: {
                items: 4,
            }
        }
    });

    $(".categories__slider").on('initialized.owl.carousel translated.owl.carousel', function () {
        // owl-carousel clones slides; observe new clones so their bg loads on view.
        $(this).find('.categories__item.set-bg').each(function () {
            if ($(this).attr('data-bg-applied') === '1') return;
            if (bgObserver) bgObserver.observe(this);
            else applyBg($(this));
        });
    });


    $('.hero__categories__all').on('click', function(){
        $('.hero__categories ul').slideToggle(400);
    });

    // Close the categories dropdown after the user picks one. On the shop page
    // the category click is handled by client-side filtering (no full reload),
    // so without this the absolute-positioned <ul> stays open over the product
    // grid. Using slideUp keeps the open/close animation consistent.
    $(document).on('click', '.hero__categories ul a', function () {
        $(this).closest('.hero__categories').find('ul').slideUp(300);
    });

    if (hasOwl) {
        /*--------------------------
            Latest Product Slider
        ----------------------------*/
        $(".latest-product__slider").owlCarousel({
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

        /*-----------------------------
            Product Discount Slider
        -------------------------------*/
        $(".product__discount__slider").owlCarousel({
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

        /*---------------------------------
            Product Details Pic Slider
        ----------------------------------*/
        $(".product__details__pic__slider").owlCarousel({
            loop: true,
            margin: 20,
            items: 4,
            dots: true,
            smartSpeed: 1200,
            autoHeight: false,
            autoplay: true
        });
    }

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