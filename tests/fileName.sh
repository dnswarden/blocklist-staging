#!/bin/bash

# Description: Check file name and values, both should correspond to each other.

set -eu

data=$(jq . edit_here_to_add_blocklists.json)

dataLength="$(jq -nr --argjson d "${data:?}" '$d|length-1')"

dataIndex=0

while [ "${dataIndex:?}" -le "${dataLength:?}" ]; do
    
    source="$(jq -nr --argjson d "${data:?}" --arg i "${dataIndex:?}" '$d[$i|tonumber]')"
    
    name="$(jq -nr --argjson d "${source:?}" '$d.name')"
    loc="$(jq -nr --argjson d "${source:?}" '$d.loc')"
    fileNumber="$(echo "$loc" | sed 's/.txt//' | sed 's/custom_filters\/normal\/id//' | sed 's/custom_filters\/wildcard\/id//')"
    value="$(jq -nr --argjson d "${source:?}" '$d.value')"
    
    if [ $fileNumber -ne $value ]; then
        echo "-------------------------------"
        echo "$name"
        echo "$loc"
        echo "$value"
        exit 1
    else
        echo "looks good for $name"
    fi
    
    dataIndex="$((dataIndex + 1))"
    
done
