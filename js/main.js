
$(function() {

  var DebtOffer = Backbone.Model.extend({

    get_interest: function(sum, span) {
      var interest = this.get("interest") || 0.0541;
          abs_int = interest + 1,
          span_abs = Math.pow(abs_int, span),
          total_per_span = sum * ( (interest * span_abs) /  (span_abs -1)),
          total = total_per_span * span;

      return {total: total,
              effective: 5.432,
              interest: interest,
              monthly: total_per_span/ 12};
    },

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
      return this.filter(function(item) {
        return item.match(cleaned_query);
      });
    }
  });

  var LoginView = Backbone.View.extend({
    events: {
      "submit form": "_form_submit"
    },
    _form_submit: function(ev) {
      this.options.app.state.set(
          {"login": $(ev.currentTarget).find("#email").val()});
      $('.modal').modal("hide");
      return false;
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
     tmpl_items: _.template($('#tmpl-items').html()),

     events: {
      "submit form#teaserForm": "_pre_form_submit",
      "submit form#realForm": "_real_form_submit"
     },

     initialize: function() {
      var view = this;
      this.form_data = new Backbone.Model({});

      this.options.app.state.on("change", $.proxy(this._render_items, this));
      this.form_data.on("change:credit", function(itm, val) {
        var $el = $(view.el);
        $el.find(".credit_sum").html(val);
        $el.find("#credit-inp").val(val);
      });
     },

     _render_items: function() {
      var credit = this.form_data.get("credit");
      if (!credit) return; // nothing to do yet

      var matches = this.options.app.offers.find_matches(this.form_data.attributes);

      if (matches.length === 0) {
        $('#results-wrapper #wrapped').html('<div class="alert alert-error offset2 span6">No results found</div>');
      } else {
        var real_credit = 1000 * credit,
            span = this.form_data.get("lent-term") / 12;
        matches = matches.map(function(item) {
          var offer = item.get_interest(real_credit, span);
          offer.match = item;
          return offer;
        });
        $('#results-wrapper #wrapped').html(
          this.tmpl_items({matches: matches, login:this.options.app.state.get("login")}));
      }
     },

     _pre_form_submit: function() {
      var $el = $(this.el),
          $tsbx = $el.find("#teaser-box"),
          $fbx = $el.find("#form-box");

      this.form_data.set("credit", Number($('#creditInput').val()));

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

      $('#results-wrapper #wrapped').html('<div class="alert alert-searching offset2 span6">Searching</div>');
      $('#results-wrapper').slideDown();

      _.each($frm.find(":input"), function(n, i) {
        var $n = $(n);
        inps[$n.attr("name")] = $n.val();
      });
      this.form_data.set(inps);
      this._render_items();

      $('html, body').animate({
           scrollTop: $('#results-wrapper').offset().top - 150
      }, 1500);
      return false;
    }
  });

  var AppState = Backbone.Model.extend({
    defaults: {
      "login": false
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

      app.loginView = new LoginView({app: app,
        el: $('#loginModal')});

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