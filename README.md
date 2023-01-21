## Staging blacklist/whitelist/customlist repo for dnswarden

This repo contains multiple blacklists and whitelists files required for [dnswarden](https://dnswarden.com/customfilter.html). Look at [update history](https://github.com/dnswarden/blocklist-staging/blob/main/update_history.txt) to see total number of domains in repo and when the lists were last updated.


Default adblock and adultfilter dns consists of lists defined in `adblockConfig` and `adultfilterConfig` in [default.json](https://github.com/dnswarden/blocklist-staging/blob/main/edit_here_to_add_blocklists.json). You can add or remove elements to them. Each element represents the list where `value==element` in `blocklistConfig`.



#### Editing a blocklist 

You can add, remove, edit and move around the arrays in [default.json](https://github.com/dnswarden/blocklist-staging/blob/main/edit_here_to_add_blocklists.json).

```
    {
      "name": "dnswarden (Tiny whitelist & blacklist)",
      "category": "Tiny",
      "url": [
        "https://raw.githubusercontent.com/dnswarden/blocklist-staging/main/blacklist/tiny_normal.txt",
        "https://raw.githubusercontent.com/dnswarden/blocklist-staging/main/whitelist/tinylist.txt",
        "https://raw.githubusercontent.com/dnswarden/blocklist-staging/main/blacklist/tiny_wildcard.txt"
      ],
      "filterType": ["b-norm", "white", "b-wild"],
      "source": "",
      "totalDomains": 0,
      "value": 113
    }
```
where,

- `"name":` String which is used to display and identify lists on [customfilter page](https://dnswarden.com/customfilter.html) and on [search page](https://dnswarden.com/search.html).

- `"category":` Strings to represent a list to which category they belong. Note: Internally this has no-effect and it is only helpful while displaying lists on [customfilter page](https://dnswarden.com/customfilter.html) and on [search page](https://dnswarden.com/search.html).

- `"url":` Array of urls for blocklists, can be one or more.

- `"filterType":` Array of strings which represents what type of filter should the list be used as. Should always be equal to number of elements in `"url":`

     `"filterType"` can take the following values 
            
     - `"b-norm"`: to match the exact domain in the list for blacklisting.
     - `"white"`: to match the exact domain in the list for whitelisting.
     - `"b-wild"`: to match a wildcard domain in the list.
       
-  `"value":` Integer, 
              
     - should be a nonrepetitive number 
     - for new entries, always use (length of `blocklistConfig` + 1)


