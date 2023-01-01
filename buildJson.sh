#!/bin/bash

set -eu

data=$(jq . edit_here_to_add_blocklists.json)

dataLength="$(jq -nr --argjson d "${data:?}" '$d|length-1')"

dataIndex=1

cp edit_here_to_add_blocklists.json customfilter.json

while [ "${dataIndex:?}" -le "${dataLength:?}" ]; do
    
    location=$(jq -r -c '.['$dataIndex'].loc' customfilter.json)
    total_domains=$(wc -l <${location:?})
    current_time=$(date -r ${location:?} -u)
    jq --arg b $total_domains --arg a "$current_time" '.['$dataIndex'].lastUpdated = $a | .['$dataIndex'].totalDomains = $b' customfilter.json >updated.json && mv updated.json customfilter.json
    
    dataIndex="$((dataIndex + 1))"
    
done

echo "Finished building customfilter.json"

total=0
dataIndex=1

while [ "${dataIndex:?}" -le "${dataLength:?}" ]; do
    current=$(jq -r -c '.['$dataIndex'].totalDomains|tonumber ' customfilter.json)
    total=$(("$total" + "$current"))
    dataIndex="$((dataIndex + 1))"
done

now=$(date -u)
echo "Updated at : $now , total domains in repo : $total" >>update_history.txt

echo "Finished calculating total domains in repo = $total"
