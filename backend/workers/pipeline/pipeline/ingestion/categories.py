"""Exhaustive mapping from source taxonomies to the frozen category enum."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Final

from .models import Category

# Direct Wikidata P31 classes. Unknown subclasses are deliberately OTHER rather
# than guessed; subsequent structured/web enrichment can safely refine them.
WIKIDATA_INSTANCE_CATEGORY: Final[dict[str, Category]] = {
    # sights / built heritage
    "Q570116": Category.SIGHT,  # tourist attraction
    "Q4989906": Category.SIGHT,  # monument
    "Q811979": Category.SIGHT,  # architectural structure
    "Q16970": Category.SIGHT,  # church building
    "Q23413": Category.SIGHT,  # castle
    "Q12518": Category.SIGHT,  # tower
    "Q39715": Category.SIGHT,  # lighthouse
    "Q12280": Category.SIGHT,  # bridge
    "Q839954": Category.SIGHT,  # archaeological site
    # museums / galleries
    "Q33506": Category.MUSEUM,
    "Q207694": Category.MUSEUM,  # art museum
    "Q1007870": Category.MUSEUM,  # art gallery
    "Q3329412": Category.MUSEUM,  # museum building
    # viewpoints
    "Q6017969": Category.VIEWPOINT,  # scenic viewpoint
    "Q1440300": Category.VIEWPOINT,  # observation tower
    "Q180174": Category.VIEWPOINT,  # observation deck
    # nature
    "Q22698": Category.PARK_NATURE,
    "Q46169": Category.PARK_NATURE,  # national park
    "Q14545628": Category.PARK_NATURE,  # nature reserve
    "Q8502": Category.PARK_NATURE,  # mountain
    "Q4421": Category.PARK_NATURE,  # forest
    "Q23397": Category.PARK_NATURE,  # lake
    "Q40080": Category.PARK_NATURE,  # beach
    "Q43483": Category.PARK_NATURE,  # botanical garden
    # entertainment
    "Q24354": Category.ENTERTAINMENT,  # theatre
    "Q41253": Category.ENTERTAINMENT,  # cinema
    "Q2416723": Category.ENTERTAINMENT,  # theme park
    "Q43501": Category.ENTERTAINMENT,  # zoo
    "Q2281788": Category.ENTERTAINMENT,  # aquarium
    "Q483110": Category.ENTERTAINMENT,  # stadium
    # nightlife
    "Q622425": Category.NIGHTLIFE,  # nightclub
    "Q187456": Category.NIGHTLIFE,  # bar
    "Q1311064": Category.NIGHTLIFE,  # pub
    "Q212198": Category.NIGHTLIFE,  # cabaret
    # shopping
    "Q11315": Category.SHOPPING,  # shopping centre
    "Q37654": Category.SHOPPING,  # market
    "Q213441": Category.SHOPPING,  # shop
    "Q180846": Category.SHOPPING,  # department store
    # food
    "Q11707": Category.RESTAURANT,
    "Q131263": Category.RESTAURANT,  # fast-food restaurant
    "Q30022": Category.CAFE,
    "Q47545": Category.CAFE,  # coffeehouse
}


def map_osm_tags(tags: Mapping[str, str]) -> Category:
    """Map an arbitrary OSM tag set; this function is total and never raises."""

    tourism = tags.get("tourism", "").lower()
    amenity = tags.get("amenity", "").lower()
    leisure = tags.get("leisure", "").lower()
    natural = tags.get("natural", "").lower()
    man_made = tags.get("man_made", "").lower()

    if tourism == "viewpoint" or (
        man_made in {"tower", "observation_tower"}
        and tags.get("tower:type", "").lower() in {"observation", "watchtower"}
    ):
        return Category.VIEWPOINT
    if tourism in {"museum", "gallery"} or amenity == "museum":
        return Category.MUSEUM
    if (
        leisure in {"park", "garden", "nature_reserve"}
        or natural in {"peak", "beach", "waterfall", "cave_entrance", "wood", "spring"}
        or tags.get("boundary", "").lower() in {"protected_area", "national_park"}
    ):
        return Category.PARK_NATURE
    if amenity in {"nightclub", "bar", "pub", "biergarten"} or tags.get("club") in {
        "nightclub",
        "music",
    }:
        return Category.NIGHTLIFE
    if amenity in {"restaurant", "fast_food", "food_court"}:
        return Category.RESTAURANT
    if amenity in {"cafe", "ice_cream"}:
        return Category.CAFE
    if "shop" in tags or amenity in {"marketplace", "market"}:
        return Category.SHOPPING
    if (
        tourism in {"zoo", "theme_park", "aquarium"}
        or amenity in {"theatre", "cinema", "arts_centre", "casino", "planetarium"}
        or leisure in {"amusement_arcade", "water_park", "stadium", "sports_centre"}
    ):
        return Category.ENTERTAINMENT
    if (
        tourism in {"attraction", "artwork"}
        or "historic" in tags
        or man_made in {"lighthouse", "obelisk", "monument", "bridge", "tower"}
        or amenity == "place_of_worship"
    ):
        return Category.SIGHT
    return Category.OTHER


def map_wikidata_types(instance_ids: Iterable[str]) -> Category:
    """Map P31 values using deterministic precedence; unknowns become OTHER."""

    categories = {WIKIDATA_INSTANCE_CATEGORY[qid] for qid in instance_ids if qid in WIKIDATA_INSTANCE_CATEGORY}
    precedence = (
        Category.VIEWPOINT,
        Category.MUSEUM,
        Category.PARK_NATURE,
        Category.SIGHT,
        Category.ENTERTAINMENT,
        Category.NIGHTLIFE,
        Category.RESTAURANT,
        Category.CAFE,
        Category.SHOPPING,
    )
    return next((category for category in precedence if category in categories), Category.OTHER)


def map_geoapify_categories(values: Iterable[str]) -> Category:
    """Map Geoapify Places category paths without depending on their order."""

    paths = {value.lower() for value in values}
    rules: tuple[tuple[tuple[str, ...], Category], ...] = (
        (("tourism.attraction.viewpoint", "natural.mountain.peak"), Category.VIEWPOINT),
        (("entertainment.museum", "tourism.sights.museum"), Category.MUSEUM),
        (("natural", "leisure.park", "leisure.garden", "national_park"), Category.PARK_NATURE),
        (("adult.nightclub", "catering.bar", "catering.pub"), Category.NIGHTLIFE),
        (("catering.restaurant", "catering.fast_food"), Category.RESTAURANT),
        (("catering.cafe", "catering.coffee_shop"), Category.CAFE),
        (("commercial", "shopping"), Category.SHOPPING),
        (("entertainment", "leisure"), Category.ENTERTAINMENT),
        (("tourism.sights", "heritage", "religion.place_of_worship"), Category.SIGHT),
    )
    for prefixes, category in rules:
        if any(path == prefix or path.startswith(prefix + ".") for path in paths for prefix in prefixes):
            return category
    return Category.OTHER


def mapping_is_contract_complete() -> bool:
    """CI invariant: all mapper outputs are members of the single enum."""

    declared = set(Category)
    reachable = set(WIKIDATA_INSTANCE_CATEGORY.values()) | {Category.OTHER}
    # OSM and Geoapify are predicate-based, so their reachability is asserted by
    # their focused fixture tests; this catches accidental foreign enum strings.
    return reachable.issubset(declared) and set(WIKIDATA_INSTANCE_CATEGORY.values()).issubset(declared)


__all__ = [
    "WIKIDATA_INSTANCE_CATEGORY",
    "map_geoapify_categories",
    "map_osm_tags",
    "map_wikidata_types",
    "mapping_is_contract_complete",
]
