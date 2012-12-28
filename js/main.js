
$(function() {

  var DebtOffer = Backbone.Model.extend({

    match: function(inp) {
      var restrictions = this.get("restrictions");
      if (!restrictions || restrictions.length === 0) return true;
      var match = _.find(restrictions, function(res) {
        var attr = res[0],
            comparator = res[1],
            val = res[2];
        if (!inp[attr]) return false;

        if (comparator === "equals") {
          return inp[attr] != val;
        }

        if (comparator === "lte") {
          return val >= inp[attr];
        }

        if (comparator === "gte") {
          return val <= inp[attr];
        }
      });
      return !match;
    }

  });

  function convert_input(attrs) {
    // convert numbers
    var ret_val = {};
    _.each(["credit", "revenue", "lent-term"], function(field){
      if (attrs[field]) {
        attrs[field] = Number(attrs[field]);
      }
    });
    _.each(_.keys(attrs), function(item) {
      var val = attrs[item];
      if (!val || val.length === 0) return;
      ret_val[item] = val;
    });
    return ret_val;
  }

  var DebtOffers = Backbone.Collection.extend({
    model: DebtOffer,
    url:  "data/offers.js",
    find_matches: function(query){
      var cleaned_query = convert_input(query);
      console.log(cleaned_query);
      return this.filter(function(item) {
        return item.match(cleaned_query);
      });
    }
  });

  // Util
  var TmplView = Backbone.View.extend({

    default_context: {},

    extend_context: function() {
      return {};
    },

    render:function () {
      var context = _.extend({},
          this.default_context,
          this.model ? this.model.toJSON() : {},
          this.extend_context());

      $(this.el).html(this.template(context));
      return this;
    }
  });

  var HomeView = TmplView.extend({
     template: _.template($('#tmpl-main').html()),
     events: {
      "submit form#teaserForm": "_pre_form_submit",
      "submit form#realForm": "_real_form_submit"
     },

     _pre_form_submit: function() {
      var $el = $(this.el),
          $tsbx = $el.find("#teaser-box"),
          val = Number($('#creditInput').val()),
          $fbx = $el.find("#form-box");

      $fbx.find(".credit_sum").html(val);
      $fbx.find("#credit-inp").val(val);

      $tsbx.animate(
            {"margin-left": "-" + ($tsbx.outerWidth() + 100)},
            {duration: 1000, "easing": "swing"});

      $fbx.animate(
            {"margin-left": 100},
            {duration: 1000, "easing": "swing"});
        return false;
     },

     _real_form_submit: function(ev) {
      var $el = $(this.el),
          $frm = $(ev.currentTarget),
          inps = {};

      _.each($frm.find(":input"), function(n, i) {
        var $n = $(n);
        inps[$n.attr("name")] = $n.val();
      });
      console.log(inps);
      var matches = this.options.app.offers.find_matches(inps);
      console.log(matches);
      return false;
    }
  });

  var AppState = Backbone.Model.extend({
    defaults: {

    }
  });


  var Router = Backbone.Router.extend({

    routes: {
        // home
        "": "home"
    },

    el: $("body"),

    initialize: function() {
      var app = this;
      app.state = new AppState({});
      app.main = $('#main');
      app.progress = 10;

      app.offers = new DebtOffers({});

    },

    show_modal: function(title, content) {
      var $el = $(this.el).find("#generalModal");
      $el.find(".close").show();
      $el.find(".modal-header h3").html(title);
      $el.find(".content-wrapper").html(content);
      $el.modal('show');
      return $el;
    },

    close_modal: function() {
      $(this.el).find("#generalModal").modal("hide");
    },

    _update_loading_progress: function(additional) {
      this.progress += additional;
      this.main.find("#progress-bar").css({"width": this.progress + "%"});
    },

    start: function() {
      var me = this;
      me._update_loading_progress(99);
      function next() {
        me._update_loading_progress(50);
      }
      return $.when(this.offers.fetch().then(next)
          ).then(function() {
            Backbone.history.start();
          });
    },


    home: function () {
        // Since the home view never changes, we instantiate it and render it only once
        if (!this.homeView) {
            this.homeView = new HomeView({app: this});
            this.homeView.render();
        } else {
            this.homeView.delegateEvents(); // delegate events when the view is recycled
        }
        this.main.html(this.homeView.el);
        this.trigger("pageLoaded", "home");
    }

  });

  
  var app = new Router();
  app.start();
  window.app = app;

});