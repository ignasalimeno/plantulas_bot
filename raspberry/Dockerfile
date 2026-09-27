FROM python:3.12-alpine
RUN apk add --no-cache jq
RUN pip install --no-cache-dir requests
COPY bridge.py /bridge.py
COPY run.sh /run.sh
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
