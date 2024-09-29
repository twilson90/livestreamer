#!/bin/bash

echo "-----------"
echo "Initializing Node dependencies..."
npm install --omit=dev
echo "-----------"

exec_args="$@ $LIVESTREAMER_ARGS"
exec $exec_args
# exec "$@ $LIVESTREAMER_ARGS"