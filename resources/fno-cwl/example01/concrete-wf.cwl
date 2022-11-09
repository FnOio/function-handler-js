cwlVersion: v1.2
class: Workflow


inputs:
  message: string
outputs:
  wf_output:
    type: string
    outputSource: uppercase/uppercase_message

steps:
  echo:
    run: ./echo.cwl
    in:
      message: message
    out: [out]
  # Here you know you want an operation that changes the case of
  # the previous step, but you do not have an implementation yet.
  uppercase:
    run: ./uppercase.cwl
    in:
      message:
        source: echo/out
    out: [uppercase_message]