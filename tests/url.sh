#!/bin/bash

# Description: Check whether blocklist sources are working.

set -eu

data=$(jq . edit_here_to_add_blocklists.json)

dataLength="$(jq -nr --argjson d "${data:?}" '$d|length-1')"

dataIndex=1

failedURLs=()

while [ "${dataIndex:?}" -le "${dataLength:?}" ]; do
    source="$(jq -nr --argjson d "${data:?}" --arg i "${dataIndex:?}" '$d[$i|tonumber]')"
    url="$(jq -nr --argjson d "${source:?}" '$d.source')"
    
    statusCode="$(wget --server-response --spider --quiet "${url}" 2>&1 | awk 'NR==1{print $2}')"
    
    if [[ $statusCode != 200 ]]; then
        failedURLs+=($url)
    fi
    
    
    
    dataIndex="$((dataIndex + 1))"
    
done





if [[ ${#failedURLs[@]} == 0 ]]; then
    echo "All URLs are working"
else
    echo "${#failedURLs[@]} failed urls : ${failedURLs[@]}"
fi
