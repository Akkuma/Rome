(function () {
	function nope(){}
	
	function Rome() {}
	function Registry() {
		this.componentsLookup = {};
		this.components = [];
		this.instances = {};	
	}

	var self = this;
	Registry.prototype = {
		findComponent: function (name) {
			return this.componentsLookup[name] || this.componentsLookup[name.name];
		},
		addComponent: function (component) {
			if (this.componentsLookup[component.name]) return;

			this.components.push(component);
			this.componentsLookup[component.name] = component;
		},
		findInstance: function (root) {
			return this.instances[root];
		},
		addInstance: function (root, instance) {
			this.instances[root] = instance;
		}
	};

	var reg = Rome.Registry = new Registry();

	//@TODO add setter to manipulate $ if set later defineProperty
	var $ = Rome.$ = self.$;

	//@TODO support multiple mixin strategy
	Rome.Strategies = {
		mixin: function (obj, mixin) {
			mixin(obj);
		}
	};

	Rome.Foundation = (function () {
		var destroy = function () {
			this.$root.remove();
		};

		return function Foundation(obj) {
			var proto = obj.prototype;
			proto.destroy = detroy;
		};
	})();

	Rome.plan = function (baseComponent, mixins) {
		reg.addComponent(baseComponent);

		mixins = mixins.length ? mixins || [mixins];
		mixins.push(Rome.Foundation);
		for	(var i = 0, len = mixins.length; i < len; i++) {
			var mixin = mixins[i];

			if (typeof mixin == 'string') {
				mixin = reg.findComponent(mixin);
			}

			Rome.Strategies.mixin(baseComponent, mixin);
		}

		wasRomeBuilt && erectInstances($('[data-rome="' + baseComponent.name + '"]'));
	};

	function erectInstances($components) {
		for (var i = 0, len = $components.length; i < len; i++) {
			Rome.erect($components[i]);
		}
	}

	var wasRomeBuilt = false;
	Rome.build = function () {
		//@TODO: Remove DOM dependency - perhaps some sort of dependency analysis instead?
		erectInstances($('[data-rome]'));

		wasRomeBuilt = true;
	};

	Rome.erect = function (root) {
		
		function Component(root) {
			this.root = root;
			this.$root = $(root);
		}
		
		Rome.Strategies.mixin(reg.find(root.getAttribute('data-rome')), Component);

		reg.addInstance(root, new Component(root));
	};

	//@TODO: Global PubSub?
	Rome.Empire;
	//@TODO: Routing?
	Rome.Roads;

	//@TODO support AMD/Common
	this.Rome = Rome;
})();