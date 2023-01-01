#!/bin/bash

# Description: Check values for repetition and make sure they are in range.

set -eu

data=$(jq . edit_here_to_add_blocklists.json)

dataLength="$(jq -nr --argjson d "${data:?}" '$d|length-1')"

echo "total blocklists $dataLength"
dataIndex=0

while [ "${dataIndex:?}" -le "${dataLength:?}" ]; do
    
    source="$(jq -nr --argjson d "${data:?}" --arg i "${dataIndex:?}" '$d[$i|tonumber]')"
    value["$dataIndex"]="$(jq -nr --argjson d "${source:?}" '$d.value')"
    name["$dataIndex"]="$(jq -nr --argjson d "${source:?}" '$d.name')"
    loc["$dataIndex"]="$(jq -nr --argjson d "${source:?}" '$d.loc')"
    
    if [[ ${value[$dataIndex]} -gt "${dataLength:?}+1" ]] && [[ ${value[$dataIndex]} != 301 ]]; then
        echo "quitting, found value greater than index size"
        echo "-------------------------------"
        echo "${name[$dataIndex]}"
        echo "${loc[$dataIndex]}"
        echo "${value[$dataIndex]}"
        echo "-------------------------------"
        exit 1
    fi
    
    dataIndex="$((dataIndex + 1))"
    
done

len=${#value[@]}


for ((i = 0; i < ${len}; i++)); do
    
    for ((j = $(($i + 1)); j < ${len}; j++)); do
        if [[ ${value[$i]} == ${value[$j]} ]]; then
            echo "Quitting after finding first instance of repetition."
            echo "-------------------------------"
            echo "${name[$i]}"
            echo "${loc[$i]}"
            echo "${value[$i]}"
            echo "-------------------------------"
            echo "${name[$j]}"
            echo "${loc[$j]}"
            echo "${value[$j]}"
            exit 1
        fi
        
    done
    
done

echo "All values are in range and found no repetition"
