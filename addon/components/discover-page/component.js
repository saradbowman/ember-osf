import Ember from 'ember';
import layout from './template';
import config from 'ember-get-config';
import moment from 'moment';
import Analytics from '../../mixins/analytics';
import { getUniqueList, getSplitParams, encodeParams } from '../../utils/elastic-query';

/**
 * @module ember-osf
 * @submodule components
 */

/**
 *  Discover-page component. Builds a search interface utilizing SHARE.
 *  See retraction-watch, registries, and preprints discover pages for working examples.
 *
 *  Majority adapted from Ember-SHARE https://github.com/CenterForOpenScience/ember-share, with additions from PREPRINTS
 *  and REGISTRIES discover pages. Original Ember-SHARE facets and PREPRINTS/REGISTRIES facets behave differently at this time.
 *  You can build a discover-page that uses Ember-SHARE type facets -OR- PREPRINTS/REGISTRIES type facets.  Would not recommend
 *  mixing until code is combined.
 *
 *  How to Use:
 *  Pass in custom text like searchPlaceholder.  The facets property will enable you to customize the filters
 *  on the left-hand side of the discover page. Sort options are the sort dropdown options.  The lockedParams are the
 *  query parameters that are always locked in your application. Each query parameter must be passed in individually,
 *  so they are reflected in the URL.  Logo and custom colors must be placed in the consuming application's stylesheet. Individual components
 *  can additionally be overridden in your application.
 *
 * Sample usage:
 * ```handlebars
 *{{discover-page
 *    activeFilters=activeFilters
 *    consumingService=consumingService
 *    detailRoute=detailRoute
 *    discoverHeader=discoverHeader
 *    facets=facets
 *    fetchedProviders=model
 *    filterMap=filterMap
 *    filterReplace=filterReplace
 *    lockedParams=lockedParams
 *    page=page
 *    provider=provider
 *    q=q
 *    queryParams=queryParams
 *    searchPlaceholder=searchPlaceholder
 *    showActiveFilters=showActiveFilters
 *    sortOptions=sortOptions
 *    subject=subject
* }}
 * ```
 * @class discover-page
 */

const MAX_SOURCES = 500;
let filterQueryParams = ['subject', 'provider', 'tags', 'sources', 'publishers', 'funders', 'institutions', 'organizations', 'language', 'contributors', 'type'];

export default Ember.Component.extend(Analytics, {
    layout,
    theme: Ember.inject.service(),
    i18n: Ember.inject.service(),
    classNames: ['discover-page'],
    // ************************************************************
    // PROPERTIES
    // ************************************************************
    /**
     * Primary filters for service - currently setup for PREPRINTS and REGISTRIES. Ember-SHARE's equivalent is facetStates.
     * @property {Object} activeFilters
     * @default { providers: [], subjects: [], types: [] }
     */
    activeFilters: { providers: [], subjects: [], types: [] },
    /**
     * Consuming app, like "preprints" or "registries".
     * @property {string} consumingService
     */
    consumingService: null, // TODO Need to pull from config instead.
    /**
     * Contributors query parameter.  If "contributors" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} contributors
     */
    contributors: '',
    /**
     * Name of detail route for consuming application, like "content" or "detail". Override if search result title should link to detail route.
     * @property {String} detailRoute
     */
    detailRoute: null,
    /**
     * Text header for top of discover page.
     * @property {String} discoverHeader
     */
    discoverHeader: null,
    /**
     * End query parameter.  If "end" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} end
     */
    end: '',
    /**
     * A list of the components to be used for the search facets.
     * @property {Array} facets
     */
    facets: Ember.computed('processedTypes', function() {
        return [
            { key: 'sources', title: 'Source', component: 'search-facet-source' },
            { key: 'date', title: 'Date', component: 'search-facet-daterange' },
            { key: 'type', title: 'Type', component: 'search-facet-worktype', data: this.get('processedTypes') },
            { key: 'tags', title: 'Tag', component: 'search-facet-typeahead' },
            { key: 'publishers', title: 'Publisher', component: 'search-facet-typeahead', base: 'agents', type: 'publisher' },
            { key: 'funders', title: 'Funder', component: 'search-facet-typeahead', base: 'agents', type: 'funder' },
            { key: 'language', title: 'Language', component: 'search-facet-language' },
            { key: 'contributors', title: 'People', component: 'search-facet-typeahead', base: 'agents', type: 'person' },
        ];
    }),
    /**
     * For PREPRINTS ONLY.  Pass in the providers fetched in preprints app so they can be used in the provider carousel
     * @property {Object} fetchedProviders
     */
    fetchedProviders: null,
    /**
     * For PREPRINTS and REGISTRIES. A mapping of activeFilters to facet names expected by SHARE. Ex. {'providers': 'sources'}
     * @property {Object} filterMap
     */
    filterMap: {},
    /**
     * For PREPRINTS and REGISTRIES. A mapping of filter names for front-end display. Ex. {OSF: 'OSF Preprints'}.
     * @property {Object} filterReplace
     */
    filterReplace: {},
    /**
     * Funders query parameter.  If "funders" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} funders
     */
    funders: '',
    /**
     * Institutions query parameter.  If "institutions" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} institutions
     */
    institutions: '',
    /**
     * Language query parameter.  If "language" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} language
     */
    language: '',
    loading: true,
    /**
     * Locked portions of search query that user cannot change.  Example: {'sources': 'PubMed Central'} will make PMC a locked source.
     * @property {Object} lockedParams
     */
    lockedParams: {},
    numberOfResults: 0,  // Number of search results returned
    numberOfSources: 0, // Number of sources
    /**
     * Organizations query parameter.  If "organizations" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} organizations
     */
    organizations: '',
     /**
     * Page query parameter.  If "page" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} page
     */
    page: 1,
    /**
     * Provider query parameter.  If "provider" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} provider
     */
    provider: '',
    providerName: null, // For PREPRINTS and REGISTRIES. Provider name, if theme.isProvider, ex: psyarxiv
        /**
     * Publishers query parameter.  If "publishers" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} publishers
     */
    publishers: '',
    /**
     * q query parameter.  If "q" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} q
     */
    q: '',
    /**
     *  Declare on consuming application's controller for query params to be active in that route.
     * @property {Array} queryParams
     */
    queryParams:  Ember.computed(function() {
        let allParams = ['q', 'start', 'end', 'sort', 'page'];
        allParams.push(...filterQueryParams);
        return allParams;
    }),
    results: Ember.ArrayProxy.create({ content: [] }), // Results from SHARE query
    /**
     * Search bar placeholder
     * @property {String} searchPlaceholder
     */
    searchPlaceholder: Ember.computed('i18n.locale', function() { // Search bar placeholder text
        return this.get('i18n').t('eosf.components.discoverPage.searchPlaceholder');
    }),
    /**
     * Total search results descriptor, "searchable preprints", for example.
     * @property {String} shareTotalText
     */
    shareTotalText: Ember.computed('i18n.locale', function() {
        return this.get('i18n').t('eosf.components.discoverPage.shareTotalText');
    }),
    /**
     * For PREPRINTS and REGISTRIES.  Displays activeFilters box above search facets.
     * @property {boolean} showActiveFilters
     */
    showActiveFilters: false,
    showLuceneHelp: false, // Is Lucene Search help modal open?
    /**
     * Size query parameter.  If "size" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} size
     */
    size: 10,
    /**
     * Sort query parameter.  If "sort" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} sort
     */
    sort: '',
    /**
     * Sort dropdown options
     * @property {Array} sortOptions
     */
    sortOptions: [{
        display: 'Relevance',
        sortBy: ''
    }, {
        display: 'Date Updated (Desc)',
        sortBy: '-date_updated'
    }, {
        display: 'Date Updated (Asc)',
        sortBy: 'date_updated'
    }, {
        display: 'Ingest Date (Asc)',
        sortBy: 'date_created'
    }, {
        display: 'Ingest Date (Desc)',
        sortBy: '-date_created'
    }],
    /**
     * Sources query parameter.  If "sources" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} sources
     */
    sources: '',
    /**
     * Start query parameter.  If "start" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} start
     */
    start: '',
    /**
     * Subject query parameter.  If "subject" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} subject
     */
    subject: '',
    /**
     * Tags query parameter.  If "tags" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} tags
     */
    tags: '',
    took: 0,
    /**
     * type query parameter.  If "type" is one of your query params, it must be passed to the component so it can be reflected in the URL.
     * @property {String} type
     */
    type: '',

    // ************************************************************
    // COMPUTED PROPERTIES and OBSERVERS
    // ************************************************************

    // TODO update this property if a solution is found for the elastic search limitation.
    // Ticket: SHARE-595
    clampedPages: Ember.computed('totalPages', 'size', function() {
        // Total pages of search results, unless total is greater than the max pages allowed.
        let maxPages = Math.ceil(10000 / this.get('size'));
        let totalPages = this.get('totalPages');
        return totalPages < maxPages ? totalPages : maxPages;
    }),
    elasticAggregations: Ember.computed(function() {
        // Ember-SHARE property.
        return {
            sources: {
                terms: {
                    field: 'sources',
                    size: MAX_SOURCES
                }
            }
        };
    }),
    facetStates: Ember.computed(...filterQueryParams, 'end', 'start', function() {
        // Ember-SHARE property.  Watches query params in URL and modifies facetStates
        let facetStates = {};
        for (let param of filterQueryParams) {
            facetStates[param] = getSplitParams(this.get(param));
        }
        facetStates.date = { start: this.get('start'), end: this.get('end') };
        return facetStates;
    }),
    facetStatesArray: Ember.computed('facetStates', function() { // Modified when query params in URL change.
        let facets = this.get('facetStates');
        let facetArray = [];
        for (let key of Object.keys(facets)) {
            facetArray.push({ key: key, value: facets[key] });
        }
        return facetArray;
    }),
    hiddenPages: Ember.computed('clampedPages', 'totalPages', function() {
        // Ember-SHARE property. Returns pages of hidden search results.
        const total = this.get('totalPages');
        const max = this.get('clampedPages');
        if (total !== max) {
            return total - max;
        }
        return null;
    }),
    providerChanged: Ember.on('init', Ember.observer('provider', function() {
        // For PREPRINTS and REGISTRIES - watches provider query param for changes and modifies activeFilters
        let filter = this.get('provider');
        if (!filter || filter === 'true' || typeof filter === 'object') return;
        if (!this.get('theme.isProvider')) {
            this.set(`activeFilters.providers`, filter.split('OR'));
            this.loadPage();
        }
    })),
    processedTypes: Ember.computed('types', function() {
        // Ember-SHARE property
        const types = this.get('types') && this.get('types').CreativeWork ? this.get('types').CreativeWork.children : {};
        return this.transformTypes(types);
    }),
    reloadSearch: Ember.observer('activeFilters.providers.@each', 'activeFilters.subjects.@each', 'activeFilters.types.@each', function() {
        // For PREPRINTS and REGISTRIES.  Reloads page if activeFilters change.
        this.set('page', 1);
        this.loadPage();
    }),
    searchUrl: Ember.computed(function() {
        // Pulls SHARE search url from config file.
        return config.OSF.shareSearchUrl;
    }),
    subjectChanged: Ember.on('init', Ember.observer('subject', function() {
        // For PREPRINTS - watches subject query param for changes and modifies activeFilters
        let filter = this.get('subject');
        if (!filter || filter === 'true' || typeof filter === 'object') return;
        this.set(`activeFilters.subjects`, filter.split('OR'));
        this.loadPage();
    })),
    typeChanged: Ember.on('init', Ember.observer('type', function() {
        // For REGISTRIES - watches type query param for changes and modifies activeFilters
        let filter = this.get('type');
        if (!filter || filter === 'true' || typeof filter === 'object') return;
        this.set(`activeFilters.types`, filter.split('OR'));
        this.loadPage();
    })),
    totalPages: Ember.computed('numberOfResults', 'size', function() {
        // Total pages of search results
        return Math.ceil(this.get('numberOfResults') / this.get('size'));
    }),

    // ************************************************************
    // Discover-page METHODS and HOOKS
    // ************************************************************

    buildLockedQueryBody(lockedParams) {
        /**
         *  For PREPRINTS, REGISTRIES, RETRACTION WATCH - services where portion of query is restricted.
         *  Builds the locked portion of the query.  For example, in preprints, type=preprint
         *  is something that cannot be modified by the user.
         *
         *  Takes in a dictionary of locked param keys matched to the locked value.
        */
        let queryBody = [];
        Object.keys(lockedParams).forEach(key => {
            let query = {};
            let queryKey = [`${key}`];
            if (key === 'tags') {
                queryKey = key;
            } else if (key === 'contributors') {
                queryKey = 'lists.contributors.name';
            }

            query[queryKey] = lockedParams[key];
            queryBody.push({
                term: query
            });
        });
        return queryBody;
    },
    getCounts() {
        // Ember-SHARE method
        let queryBody = JSON.stringify({
            size: 0,
            aggregations: {
                sources: {
                    cardinality: {
                        field: 'sources',
                        precision_threshold: MAX_SOURCES
                    }
                }
            }
        });
        return Ember.$.ajax({
            url: this.get('searchUrl'),
            crossDomain: true,
            type: 'POST',
            contentType: 'application/json',
            data: queryBody
        }).then((json) => {
            this.setProperties({
                numberOfEvents: json.hits.total,
                numberOfSources: json.aggregations.sources.value
            });
        });
    },
    getQueryBody() {
        // Builds query body for SHARE
        let filters = this.buildLockedQueryBody(this.get('lockedParams')); // Empty list if no locked query parameters
        // From Ember-SHARE. Looks at facetFilters (partial SHARE queries already built) and adds them to query body
        let facetFilters = this.get('facetFilters');
        for (let k of Object.keys(facetFilters)) {
            let filter = facetFilters[k];
            if (filter) {
                if (Ember.$.isArray(filter)) {
                    filters = filters.concat(filter);
                } else {
                    filters.push(filter);
                }
            }
        }

        // For PREPRINTS and REGISTRIES.  Adds activeFilters to query body.
        const activeFilters = this.get('activeFilters');
        const filterMap = this.get('filterMap');
        for (const key in filterMap) {
            const val = filterMap[key];
            const filterList = activeFilters[key];

            if (!filterList.length || (key === 'providers' && this.get('theme.isProvider')))
                continue;

            filters.push({
                terms: {
                    [val]: filterList
                }
            });
        }

        // For PREPRINTS and REGISTRIES. If theme.isProvider, add this provider to the query body
        if (this.get('theme.isProvider') && this.get('providerName') !== null) {
            filters.push({
                terms: {
                    sources: [this.get('providerName')]
                }
            });
        }

        let query = {
            query_string: {
                query: this.get('q') || '*'
            }
        };
        if (filters.length) {
            query = {
                bool: {
                    must: query,
                    filter: filters
                }
            };
        }

        let page = this.get('page');
        let queryBody = {
            query,
            from: (page - 1) * this.get('size')
        };
        if (this.get('sort')) {
            let sortBy = {};
            sortBy[this.get('sort').replace(/^-/, '')] = this.get('sort')[0] === '-' ? 'desc' : 'asc';
            queryBody.sort = sortBy;
        }
        if (page === 1 || this.get('firstLoad')) {
            queryBody.aggregations = this.get('elasticAggregations');
        }

        this.set('displayQueryBody', { query });
        return this.set('queryBody', queryBody);
    },
    getTypes() {
        // Ember-SHARE method
        return Ember.$.ajax({
            url: config.OSF.shareApiUrl + '/schema/creativework/hierarchy/',
            crossDomain: true,
            type: 'GET',
            contentType: 'application/vnd.api+json',
        }).then((json) => {
            if (json.data) {
                this.set('types', json.data);
            }
        });
    },
    init() {
        //TODO Sort initial results on date_modified
        // Runs on initial render.
        this._super(...arguments);
        this.set('firstLoad', true);
        this.set('facetFilters', Ember.Object.create());
        this.getTypes();
        this.set('debouncedLoadPage', this.loadPage.bind(this));
        this.getCounts();
        this.loadProvider();
        this.loadPage();
    },
    loadPage() {
        let queryBody = JSON.stringify(this.getQueryBody());
        this.set('loading', true);
        return Ember.$.ajax({
            url: this.get('searchUrl'),
            crossDomain: true,
            type: 'POST',
            contentType: 'application/json',
            data: queryBody
        }).then((json) => {
            if (this.isDestroyed || this.isDestroying) return;
            let results = json.hits.hits.map(hit => {
                // HACK: Make share data look like apiv2 preprints data
                let result = Ember.merge(hit._source, {
                    id: hit._id,
                    type: 'elastic-search-result',
                    workType: hit._source['@type'],
                    abstract: hit._source.description,
                    subjects: hit._source.subjects.map(each => ({ text: each })),
                    providers: hit._source.sources.map(item => ({ name: item })), // For PREPRINTS, REGISTRIES
                    hyperLinks: [// Links that are hyperlinks from hit._source.lists.links
                        {
                            type: 'share',
                            url: config.OSF.shareBaseUrl + `${hit._source.type}` + '/' + hit._id
                        }
                    ],
                    infoLinks: [], // Links that are not hyperlinks  hit._source.lists.links
                    registrationType: hit._source.registration_type // For REGISTRIES
                });

                hit._source.identifiers.forEach(function(identifier) {
                    if (identifier.startsWith('http://')) {
                        result.hyperLinks.push({ url: identifier });
                    } else {
                        const spl = identifier.split('://');
                        const [type, uri, ..._] = spl; // jshint ignore:line
                        result.infoLinks.push({ type, uri });
                    }
                });

                result.contributors = result.lists.contributors ? result.lists.contributors
                  .sort((b, a) => (b.order_cited || -1) - (a.order_cited || -1))
                  .map(contributor => ({
                        users: Object.keys(contributor)
                          .reduce(
                              (acc, key) => Ember.merge(acc, { [Ember.String.camelize(key)]: contributor[key] }),
                              { bibliographic: contributor.relation !== 'contributor' }
                          )
                    })) : [];

                // Temporary fix to handle half way migrated SHARE ES
                // Only false will result in a false here.
                result.contributors.map(contributor => contributor.users.bibliographic = !(contributor.users.bibliographic === false));  // jshint ignore:line

                return result;
            });

            if (json.aggregations) {
                this.set('aggregations', json.aggregations);
            }
            this.setProperties({
                numberOfResults: json.hits.total,
                took: moment.duration(json.took).asSeconds(),
                loading: false,
                firstLoad: false,
                results: results,
                queryError: false,
                shareDown: false,
            });
            if (this.get('totalPages') && this.get('totalPages') < this.get('page')) {
                this.search();
            }
        }, (errorResponse) => {
            this.setProperties({
                loading: false,
                firstLoad: false,
                numberOfResults: 0,
                results: []
            });
            if (errorResponse.status === 400) {
                // If issue with search query, for example, invalid lucene search syntax
                this.set('queryError', true);
            } else {
                // SHARE is Down
                this.set('shareDown', true);
            }
        });
    },
    loadProvider() {
        /**
         *  For PREPRINTS and REGISTRIES
         *  Loads preprint provider if theme.isProvider
         *  Needed because theme's provider was not loading before SHARE was queried.
         */
        if (this.get('theme.isProvider')) {
            this.get('theme.provider').then(provider => {
                this.set('providerName', provider.get('name'));
                this.loadPage();
            });
        }
    },
    scrollToResults() {
        // Scrolls to top of search results
        Ember.$('html, body').scrollTop(Ember.$('.results-top').position().top);
    },
    search() {
        if (!this.get('firstLoad')) {
            this.set('page', 1);
        }
        this.set('loading', true);
        this.set('results', []);
        Ember.run.debounce(() => {
            this.get('debouncedLoadPage')();
        }, 500);
    },
    trackDebouncedSearch() {
        // For use in tracking debounced search of registries in Keen and GA
        Ember.get(this, 'metrics')
            .trackEvent({
                category: 'input',
                action: 'onkeyup',
                label: 'Discover - Search',
                extra: this.get('q')

            });
    },
    transformTypes(obj) {
        // Ember-SHARE method
        if (typeof (obj) !== 'object') {
            return obj;
        }

        for (let key in obj) {
            let lowKey = key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
            obj[lowKey] = this.transformTypes(obj[key]);
            if (key !== lowKey) {
                delete obj[key];
            }
        }
        return obj;
    },
    actions: {
        addFilter(type, filterValue) {
            // Ember-SHARE action. Used to add filter from the search results.
            let currentValue = getSplitParams(this.get(type)) || [];
            let newValue = getUniqueList([filterValue].concat(currentValue));
            this.set(type, encodeParams(newValue));
        },
        clearFilters() {
            // Clears facetFilters for SHARE-type facets
            this.set('facetFilters', Ember.Object.create());
            for (var param in filterQueryParams) {
                let key = filterQueryParams[param];
                if (filterQueryParams.indexOf(key) > -1) {
                    this.set(key, '');
                }
            }
            this.set('start', '');
            this.set('end', '');
            this.set('sort', '');
            this.search();
            // For PREPRINTS and REGISTRIES. Clears activeFilters.
            let restoreActiveFilters = {};
            Object.keys(this.get('activeFilters')).forEach(filter => {
                if (filter === 'providers') {
                    restoreActiveFilters[filter] = this.get('theme.isProvider') ? this.get('activeFilters.providers') : [];
                } else {
                    restoreActiveFilters[filter] = [];
                }

            });
            this.set('activeFilters', restoreActiveFilters);Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: 'Discover - Clear Filters'
                });
        },
        filtersChanged() {
            // Ember SHARE action. Fired in faceted-search component when Ember-SHARE facets are modified.
            this.search();
        },
        loadPage(newPage, scroll = true) {
            if (newPage === this.get('page') || newPage < 1 || newPage > this.get('totalPages')) {
                return;
            }
            this.set('page', newPage);
            if (scroll) {
                this.scrollToResults();
            }
            this.loadPage();
        },
        modifyRegistrationType(filter, query) {
            // For REGISTRIES only - modifies "type" query param if "provider" query param changes.
            // Registries are unusual, since the OSF Registration Type facet depends upon the Providers facet
            if (filter === 'provider' && this.get('consumingService') === 'registries') {
                if (query.length === 1 && query[0] === 'OSF') {
                    this.set('type', this.get('activeFilters.types').join('OR'));
                } else {
                    this.set('type', '');
                }
            }
        },
        removeFilter(type, filterValue) {
            // Ember-SHARE action.  Could be used to remove filters in Active Filters box (when Ember-SHARE and PREPRINTS/REGISTRIES code here is integrated)
            let currentValue = getSplitParams(this.get(type)) || [];
            let index = currentValue.indexOf(filterValue);
            if (index > -1) {
                currentValue.splice(index, 1);
            }
            currentValue = currentValue.length ? encodeParams(currentValue) : '';
            this.set(type, currentValue);
            this.get('facetFilters');
        },
        search() {
            // Only want to track search here when button clicked. Keypress search tracking is debounced in trackSearch
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: 'Discover - Search',
                    extra: this.get('q')
                });

            this.search();
        },
        selectSortOption(option) {
            // Runs when sort option changed in dropdown
            this.set('sort', option);
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'dropdown',
                    action: 'select',
                    label: `Sort by: ${option || 'relevance'}`
                });
            this.search();
        },
        setLoadPage(pageNumber) {
            // Adapted from PREPRINTS for pagination. When paginating, sets page and scrolls to top of results.
            this.set('page', pageNumber);
            if (scroll) {
                this.scrollToResults();
            }
            this.loadPage();
        },
        toggleShowLuceneHelp() {
            // Toggles display of Lucene Search help modal
            this.toggleProperty('showLuceneHelp');
        },
        typing(val, event) {
            /**
             * Fires on keyup in search bar.
             *
             * Ignores all keycodes that don't result in the value changing
             * 8 == Backspace, 32 == Space
             */
            if (event.keyCode < 49 && !(event.keyCode === 8 || event.keyCode === 32)) {
                return;
            }
            // Tracks search on keypress, debounced
            Ember.run.debounce(this, this.trackDebouncedSearch, 3000);
            this.search();
        },
        updateFilters(filterType, item) {
            // For PREPRINTS and REGISTRIES.  Modifies activeFilters.
            item = typeof item === 'object' ? item.text : item;
            const filters = Ember.$.extend(true, Ember.A(), this.get(`activeFilters.${filterType}`));
            const hasItem = filters.includes(item);
            const action = hasItem ? 'remove' : 'push';
            filters[`${action}Object`](item);
            this.set(`activeFilters.${filterType}`, filters);
            this.send('updateQueryParams', filterType, filters);

            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'filter',
                    action: hasItem ? 'remove' : 'add',
                    label: `Discover - ${filterType} ${item}`
                });
        },
        updateParams(key, value) {
            // Ember SHARE action. Updates query params in URL.
            if (key === 'date') {
                this.set('start', value.start);
                this.set('end', value.end);
            } else {
                value = value ? encodeParams(value) : '';
                this.set(key, value);
            }
        },
        updateQueryParams(pluralFilter, query) {
            // For PREPRINTS and REGISTRIES.  Used to modify query parameters in URL when activeFilters change.
            const filter = Ember.String.singularize(pluralFilter);
            if (pluralFilter !== 'providers' || !this.get('theme.isProvider')) {
                this.set(`${filter}`, query.join('OR'));
                this.send('modifyRegistrationType', filter, query);
            }
        }
    }
});
