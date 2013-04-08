(function () {
	function nope(){}
	
	function Rome() {}

	//Potential for supporting multiple registries within Rome?
	function Registry() {
		this.componentsLookup = {};
		this.components = [];
		this.instances = {};	
	}

	// Should be a reference to the window object for now
	var self = this;
	Registry.prototype = {
		findComponent: function (name) {
			return this.componentsLookup[name] || this.componentsLookup[name.name];
		},
		addComponent: function (base, component, mixins) {
			var name = component.name || component;
			if (this.componentsLookup[name]) return;

			//this.components.push(component);
			this.componentsLookup[name] = { base: base, mixins: mixins };
		},
		//@TODO: Change to store on the actual element rather than in memory?
		findInstance: function (root) {
			return root._rome || this.instances[root];
		},
		addInstance: function (root, instance) {
			this.instances[root] = instance;
			root._rome = { component: instance };
		}
	};

	var reg = Rome.Registry = new Registry();

	//@TODO add setter to manipulate $ if set later defineProperty
	var $ = Rome.$ = self.$;

	// Strategies are a minimal abstraction/transformation layer
	// that will allow users to replace the OOBE of Rome.
	Rome.Strategies = {
		mixin: function (obj, mixin) {
			mixin(obj);
		}
	};

	// The foundation for all components provided by Rome.
	// Allows users to provide a new foundation for functionality they want baked in.
	Rome.Foundation = (function () {
		var destroy = function () {
			this.$root.remove();
		};

		return function Foundation(obj) {
			var proto = obj.prototype;
			proto.destroy = destroy;
		};
	})();

	// Before you can erect a component you must plan for it.
	// The `mixins` is an array of all the functionality you want in a component.
	// The first mixin is treated as the `baseComponent`
	Rome.plan = function (mixins) {
		// An anonymous function to merge all mixins into, so that the baseComponent 
		// can be the last mixin merged into the base
		var base = function () {},
			baseComponent = mixins.shift();

		// We always add Rome.Foundation for common functionality in components
		// and let the baseComponent reign supreme
		mixins.push(Rome.Foundation);
		mixins.push(baseComponent);

		for	(var i = 0, len = mixins.length; i < len; i++) {
			var mixin = mixins[i];

			if (typeof mixin == 'string') {
				mixin = reg.findComponent(mixin);
			}

			Rome.Strategies.mixin(base, mixin);
		}

		reg.addComponent(base, baseComponent, mixins);

		// If Rome has already been built we want to instantly erect the newly planned component
		wasRomeBuilt && erectInstances($('[data-rome="' + baseComponent.name + '"]'));
	};

	function erectInstances($components) {
		for (var i = 0, len = $components.length; i < len; i++) {
			Rome.erect($components[i]);
		}
	}

	var wasRomeBuilt = false;
	// After you're done planning all your components or simply want to start erecting your components.
	Rome.build = function () {
		//@TODO: Remove DOM dependency - perhaps some sort of dependency analysis instead?
		//Configurable selector would be useful + configurable data attributes
		erectInstances($('[data-rome]'));

		wasRomeBuilt = true;
	};

	//Should this even be publicly exposed?
	Rome.erect = function (root) {
		var storedComponent = reg.findComponent(root.getAttribute('data-rome'));

		if (!storedComponent.cachedComponent) {
			function Component(root) {
				this.root = root;
				this.$root = $(root);
			
				// Executes each mixin's constructor function, if one exists, which is based on the mixin's name
				var mixins = storedComponent.mixins;
				for (var i = 0, len = mixins.length; i < len; i++) {
					var mixinName = mixins[i].name;
					this[mixinName] && this[mixinName]();
				};
			}
			
			// Finally adds in everything from the base component's `prototype` before creating a new component instance
			Component.prototype = storedComponent.base.prototype;
			// Cache this Rome.Component, so that creating numerous instances doesn't require recreating the function
			storedComponent.cachedComponent = Component;
		}

		//Need mixin initialization strategy?
		reg.addInstance(root, new storedComponent.cachedComponent(root));
	};

	//@TODO: Global PubSub?
	Rome.Empire;
	//@TODO: Routing?
	Rome.Roads;

	//@TODO support AMD/Common
	this.Rome = Rome;
})();