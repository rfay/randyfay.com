//$Id: translatableregions.js,v 1.5 2010/02/24 20:31:34 rfay Exp $
/**
 * @file
 * Javascript to support translatable regions on the page.
 * 
 * Uses the jquery.translate plugin.
 * Adapted from translatableregions module by Dave Trainer.
 */
(function ($) {

  Drupal.behaviors.translatableregions = {
      attach: transform_page
  };

  function transform_page(context, settings) {
    $.translate(function() {  // After translation engine is ready.
      var link = $("<a />").attr("href", "#").attr("class","translator");
      var wrapper = $("<span></span>").attr("class","translator");
      var translate_selectors = settings.translatableregions.translate_selectors;
      var auto_translate = settings.translatableregions.auto_translate;  
      var hide_translate_button = settings.translatableregions.hide_translate_button;
      var always_show_translate_buttons = settings.translatableregions.always_show_translate_buttons;

      // If auto_translate, we'll just translate the block no matter what.
      if (auto_translate) {
        var browser_language = get_browser_language();
        $(translate_selectors).each(function (i) {
          var element = $(this);
          translate_element(element, browser_language);
        });
      } 
      // Otherwise, put a select at the top of the block offering translation.
      else if (always_show_translate_buttons || !hide_translate_button) {
        var browser_language = get_browser_language();

        $(translate_selectors).each(function (i) {
          var element = $(this);

          var button = $("<input type='submit' />")
          .val(Drupal.t("Translate to"))
          .click(function(){
            translate_element(element, $(this).parent().children('select').val());
          });

          // Maintainer provided wonderful help on this at
          // http://code.google.com/p/jquery-translate/issues/detail?id=30
          $.translate.ui({
            tags: ["select", "option"],
            filter: $.translate.isTranslatable,
            label: $.translate.toNativeLanguage, //default
            includeUnknown: false
          })
          .val(browser_language)
          .change(function(){ //when selecting another language
            translate_element(element, $(this).val());
          })
          .prependTo($(this))
          .parent()
          .prepend(button)
        });
      }
    });
  }



  /**
   * Translate an element into a target language.
   * @param element
   *   The element to be translated.
   * @param target_language
   *   The language code to translate to. Must match one of Google's array.
   */
  function translate_element(element, target_language) {
    element.translate(target_language, { 
      //TODO: Make user-configurable exclusions
      not: '.option, #demo, #source, pre, .jq-translate-ui', //exclude these elements
      fromOriginal:true //always translate from orig (even after the page has been translated)
    });
    element.children('div.gBranding').remove();
    $.translate.getBranding().appendTo(element).prepend(Drupal.t("Automatic translation") + " ");
  }
  
  /**
   * Figure out the language code that google will support.
   */
  function get_browser_language() {
    var lang = navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage;
    var langcode = $.translate.toLanguageCode(lang) || lang.substr(0,2);
    return langcode;
  }

})(jQuery);